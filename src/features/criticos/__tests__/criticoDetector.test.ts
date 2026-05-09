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
  });
});
