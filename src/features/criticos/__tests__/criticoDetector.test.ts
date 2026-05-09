import { describe, it, expect } from 'vitest';
import {
  isCritico,
  calculateSLA,
  isOverdue,
  generateEscalationPath,
  validateConfidenceThreshold,
  type CriticoThreshold,
  type CriticosConfig,
} from '../utils/criticoDetector';

describe('criticoDetector', () => {
  const mockThreshold: CriticoThreshold = {
    id: 'thresh-1',
    labId: 'lab-1',
    analitoId: 'analito-1',
    analitoNome: 'Glucose',
    min: 70,
    max: 150,
    unidade: 'mg/dL',
    severidade: 'alta',
    ativo: true,
  };

  const mockConfig: CriticosConfig = {
    ativo: true,
    canaisPrefixo: 'SMS_THEN_EMAIL',
    slaMinutosTarget: 60,
    slaAlertas: {
      minutos50Pct: 30,
      minutos100Pct: 60,
    },
  };

  describe('isCritico', () => {
    it('should detect value below minimum', () => {
      const result = isCritico(50, [mockThreshold]);
      expect(result.isCritico).toBe(true);
      expect(result.severidade).toBe('alta');
    });

    it('should detect value above maximum', () => {
      const result = isCritico(200, [mockThreshold]);
      expect(result.isCritico).toBe(true);
      expect(result.severidade).toBe('alta');
    });

    it('should not mark value within range as critical', () => {
      const result = isCritico(100, [mockThreshold]);
      expect(result.isCritico).toBe(false);
    });

    it('should respect alwaysCritico flag', () => {
      const thresholdAlways = { ...mockThreshold, alwaysCritico: true };
      const result = isCritico(100, [thresholdAlways]);
      expect(result.isCritico).toBe(true);
    });

    it('should skip neverCritico flag', () => {
      const thresholdNever = { ...mockThreshold, neverCritico: true };
      const result = isCritico(50, [thresholdNever]);
      expect(result.isCritico).toBe(false);
    });

    it('should apply conditional age filter', () => {
      const conditionalThreshold = {
        ...mockThreshold,
        condicional: { idadeMin: 18, idadeMax: 65 },
      };
      const result = isCritico(50, [conditionalThreshold], { idade: 10, sexo: 'M' });
      expect(result.isCritico).toBe(false);
    });

    it('should apply conditional sex filter', () => {
      const conditionalThreshold = {
        ...mockThreshold,
        condicional: { sexo: 'F' },
      };
      const result = isCritico(50, [conditionalThreshold], { idade: 30, sexo: 'M' });
      expect(result.isCritico).toBe(false);
    });

    it('should ignore inactive thresholds', () => {
      const inactiveThreshold = { ...mockThreshold, ativo: false };
      const result = isCritico(50, [inactiveThreshold]);
      expect(result.isCritico).toBe(false);
    });

    it('should detect value at exact minimum boundary', () => {
      const result = isCritico(70, [mockThreshold]);
      expect(result.isCritico).toBe(false); // 70 is not < min
    });

    it('should detect value just below minimum', () => {
      const result = isCritico(69.9, [mockThreshold]);
      expect(result.isCritico).toBe(true);
    });

    it('should detect value at exact maximum boundary', () => {
      const result = isCritico(150, [mockThreshold]);
      expect(result.isCritico).toBe(false); // 150 is not > max
    });

    it('should detect value just above maximum', () => {
      const result = isCritico(150.1, [mockThreshold]);
      expect(result.isCritico).toBe(true);
    });

    it('should apply conditional age max boundary', () => {
      const conditionalThreshold = {
        ...mockThreshold,
        condicional: { idadeMin: 18, idadeMax: 65 },
      };
      const result = isCritico(50, [conditionalThreshold], { idade: 66, sexo: 'M' });
      expect(result.isCritico).toBe(false);
    });

    it('should handle threshold with only min boundary', () => {
      const minOnlyThreshold = { ...mockThreshold, max: null };
      expect(isCritico(50, [minOnlyThreshold]).isCritico).toBe(true);
      expect(isCritico(100, [minOnlyThreshold]).isCritico).toBe(false);
    });

    it('should handle threshold with only max boundary', () => {
      const maxOnlyThreshold = { ...mockThreshold, min: null };
      expect(isCritico(200, [maxOnlyThreshold]).isCritico).toBe(true);
      expect(isCritico(100, [maxOnlyThreshold]).isCritico).toBe(false);
    });

    it('should return threshold reference with detection', () => {
      const result = isCritico(50, [mockThreshold]);
      expect(result.threshold).toBe(mockThreshold);
    });

    it('should evaluate thresholds in order and return first match', () => {
      const threshold1 = { ...mockThreshold, id: 't1', max: 80 };
      const threshold2 = { ...mockThreshold, id: 't2', max: 150 };
      const result = isCritico(85, [threshold1, threshold2]);
      expect(result.threshold?.id).toBe('t1'); // 85 > 80, so t1 matches first
    });
  });

  describe('calculateSLA', () => {
    it('should calculate three tier deadlines', () => {
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, mockConfig);

      expect(sla.tier1Deadline).toEqual(new Date('2026-05-08T10:15:00Z'));
      expect(sla.tier2Deadline).toEqual(new Date('2026-05-08T10:30:00Z'));
      expect(sla.tier3Deadline).toEqual(new Date('2026-05-08T11:00:00Z'));
      expect(sla.status).toBe('em_prazo');
    });

    it('should use custom slaMinutosTarget', () => {
      const customConfig = { ...mockConfig, slaMinutosTarget: 45 };
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, customConfig);

      expect(sla.tier3Deadline).toEqual(new Date('2026-05-08T10:45:00Z'));
    });

    it('should mark as nao_aplicavel when config inactive', () => {
      const inactiveConfig = { ...mockConfig, ativo: false };
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, inactiveConfig);

      expect(sla.status).toBe('nao_aplicavel');
    });

    it('should still calculate deadlines even when inactive', () => {
      const inactiveConfig = { ...mockConfig, ativo: false };
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, inactiveConfig);

      expect(sla.tier1Deadline).toEqual(new Date('2026-05-08T10:15:00Z'));
      expect(sla.tier2Deadline).toEqual(new Date('2026-05-08T10:30:00Z'));
      expect(sla.tier3Deadline).toEqual(new Date('2026-05-08T11:00:00Z'));
    });

    it('should use default slaMinutosTarget of 60 when not specified', () => {
      const configNoTarget = { ...mockConfig, slaMinutosTarget: undefined as any };
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, configNoTarget);

      expect(sla.tier3Deadline).toEqual(new Date('2026-05-08T11:00:00Z'));
    });

    it('should use 60 min default when slaMinutosTarget is 0', () => {
      const zeroConfig = { ...mockConfig, slaMinutosTarget: 0 };
      const criticoTime = new Date('2026-05-08T10:00:00Z');
      const sla = calculateSLA(criticoTime, zeroConfig);
      // When slaMinutosTarget is 0, calculateSLA uses logical OR: 0 || 60 = 60
      expect(sla.tier3Deadline).toEqual(new Date('2026-05-08T11:00:00Z'));
    });
  });

  describe('isOverdue', () => {
    it('should return true when deadline passed', () => {
      const deadline = new Date('2026-05-08T10:00:00Z');
      const now = new Date('2026-05-08T10:01:00Z');
      expect(isOverdue(deadline, now)).toBe(true);
    });

    it('should return false when deadline not yet reached', () => {
      const deadline = new Date('2026-05-08T10:01:00Z');
      const now = new Date('2026-05-08T10:00:00Z');
      expect(isOverdue(deadline, now)).toBe(false);
    });

    it('should use current time if not provided', () => {
      const futureDeadline = new Date(Date.now() + 10 * 60 * 1000);
      expect(isOverdue(futureDeadline)).toBe(false);
    });

    it('should return false when deadline equals current time', () => {
      const deadline = new Date('2026-05-08T10:00:00Z');
      const now = new Date('2026-05-08T10:00:00Z');
      expect(isOverdue(deadline, now)).toBe(false);
    });

    it('should handle millisecond precision', () => {
      const deadline = new Date('2026-05-08T10:00:00.999Z');
      const now = new Date('2026-05-08T10:00:01.000Z');
      expect(isOverdue(deadline, now)).toBe(true);
    });
  });

  describe('generateEscalationPath', () => {
    it('should prioritize SMS then EMAIL', () => {
      const path = generateEscalationPath(mockThreshold, mockConfig);
      expect(path[0].canal).toBe('SMS');
      expect(path[1].canal).toBe('EMAIL');
    });

    it('should include webhook for alta severidade', () => {
      const altaThreshold = { ...mockThreshold, severidade: 'alta' };
      const path = generateEscalationPath(altaThreshold, mockConfig);
      const webhookChannel = path.find((c) => c.canal === 'WEBHOOK');
      expect(webhookChannel).toBeDefined();
    });

    it('should exclude webhook for baixa severidade', () => {
      const baixaThreshold = { ...mockThreshold, severidade: 'baixa' };
      const path = generateEscalationPath(baixaThreshold, mockConfig);
      const webhookChannel = path.find((c) => c.canal === 'WEBHOOK');
      expect(webhookChannel).toBeUndefined();
    });

    it('should support EMAIL-only config', () => {
      const emailConfig = { ...mockConfig, canaisPrefixo: 'EMAIL' };
      const path = generateEscalationPath(mockThreshold, emailConfig);
      expect(path[0].canal).toBe('EMAIL');
    });

    it('should support SMS-only config', () => {
      const smsConfig = { ...mockConfig, canaisPrefixo: 'SMS' };
      const path = generateEscalationPath(mockThreshold, smsConfig);
      expect(path[0].canal).toBe('SMS');
    });

    it('should set correct order field for SMS then EMAIL', () => {
      const path = generateEscalationPath(mockThreshold, mockConfig);
      expect(path[0].order).toBe(1);
      expect(path[1].order).toBe(2);
    });

    it('should set retry=true for SMS and EMAIL channels', () => {
      const path = generateEscalationPath(mockThreshold, mockConfig);
      const smsChannel = path.find((c) => c.canal === 'SMS');
      const emailChannel = path.find((c) => c.canal === 'EMAIL');
      expect(smsChannel?.retry).toBe(true);
      expect(emailChannel?.retry).toBe(true);
    });

    it('should set retry=false for WEBHOOK channel', () => {
      const altaThreshold = { ...mockThreshold, severidade: 'alta' };
      const path = generateEscalationPath(altaThreshold, mockConfig);
      const webhookChannel = path.find((c) => c.canal === 'WEBHOOK');
      expect(webhookChannel?.retry).toBe(false);
    });

    it('should maintain correct order even with webhook', () => {
      const altaThreshold = { ...mockThreshold, severidade: 'alta' };
      const path = generateEscalationPath(altaThreshold, mockConfig);
      expect(path.map((c) => c.order)).toEqual([1, 2, 3]);
    });
  });

  describe('validateConfidenceThreshold', () => {
    it('should pass for confidence >= 0.85', () => {
      expect(() => validateConfidenceThreshold(0.85)).not.toThrow();
      expect(() => validateConfidenceThreshold(0.95)).not.toThrow();
      expect(() => validateConfidenceThreshold(1.0)).not.toThrow();
    });

    it('should throw for confidence < 0.85', () => {
      expect(() => validateConfidenceThreshold(0.84)).toThrow('below 0.85');
      expect(() => validateConfidenceThreshold(0.5)).toThrow('below 0.85');
    });

    it('should throw for invalid confidence values', () => {
      expect(() => validateConfidenceThreshold(-0.1)).toThrow('Invalid confidence');
      expect(() => validateConfidenceThreshold(1.1)).toThrow('Invalid confidence');
    });

    it('should throw for 0.0 confidence as below threshold', () => {
      expect(() => validateConfidenceThreshold(0.0)).toThrow('below 0.85');
    });

    it('should accept exact boundary 0.85', () => {
      expect(() => validateConfidenceThreshold(0.85)).not.toThrow();
    });

    it('should reject just below boundary 0.8499', () => {
      expect(() => validateConfidenceThreshold(0.8499)).toThrow('below 0.85');
    });

    it('should pass for high confidence values', () => {
      expect(() => validateConfidenceThreshold(0.99)).not.toThrow();
      expect(() => validateConfidenceThreshold(1.0)).not.toThrow();
    });
  });
});
