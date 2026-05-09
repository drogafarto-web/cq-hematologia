import { describe, it, expect, vi } from 'vitest';
import { getEscalationRecipients, mergeEscalationRecipients } from '../utils/routingEngine';
import type { RoutingRule, CriticoDetectionResult } from '../utils/routingEngine';
import { Timestamp } from 'firebase/firestore';

describe('Routing Engine', () => {
  const mockNow = Timestamp.now();
  const mockPrimaryRtId = 'rt-primary-001';

  describe('getEscalationRecipients', () => {
    const mockCritico: CriticoDetectionResult = {
      analitoId: 'rbc',
      severidade: 'alta',
      valor: 2.5,
      unidade: 'M/uL',
      pacienteId: 'pac-123',
      laudoId: 'laudo-456',
      timestamp: mockNow,
    };

    it('should match "all" rule', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-1',
          labId: 'lab-123',
          criterioBloco: 'all',
          recipients: {
            operadorIds: ['op-all-1', 'op-all-2'],
            telefones: ['555-1111'],
            emails: ['all@lab.com'],
          },
          slaMinutos: 30,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      expect(result.operadorIds).toContain('op-all-1');
      expect(result.operadorIds).toContain('op-all-2');
      expect(result.telefones).toContain('555-1111');
      expect(result.slaMinutos).toBe(30);
    });

    it('should match "byAnalyte" rule', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-2',
          labId: 'lab-123',
          criterioBloco: 'byAnalyte',
          analitoIds: ['rbc', 'wbc'],
          recipients: {
            operadorIds: ['op-analyte-1'],
            telefones: [],
            emails: ['analyte@lab.com'],
          },
          slaMinutos: 20,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      expect(result.operadorIds).toContain('op-analyte-1');
      expect(result.slaMinutos).toBe(20);
    });

    it('should not match "byAnalyte" rule if analyte not in list', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-2',
          labId: 'lab-123',
          criterioBloco: 'byAnalyte',
          analitoIds: ['wbc', 'plt'],
          recipients: {
            operadorIds: ['op-analyte-1'],
            telefones: [],
            emails: ['analyte@lab.com'],
          },
          slaMinutos: 20,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      // Should fall back to primary RT
      expect(result.operadorIds).toContain(mockPrimaryRtId);
    });

    it('should match "bySeverity" rule', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-3',
          labId: 'lab-123',
          criterioBloco: 'bySeverity',
          severidades: ['alta'],
          recipients: {
            operadorIds: ['op-severity-1'],
            telefones: ['555-2222'],
            emails: [],
          },
          slaMinutos: 15,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      expect(result.operadorIds).toContain('op-severity-1');
      expect(result.slaMinutos).toBe(15);
    });

    it('should match "byAnalyteAndSeverity" rule', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-4',
          labId: 'lab-123',
          criterioBloco: 'byAnalyteAndSeverity',
          analitoIds: ['rbc'],
          severidades: ['alta'],
          recipients: {
            operadorIds: ['op-specialist-1'],
            telefones: ['555-3333'],
            emails: ['specialist@lab.com'],
          },
          slaMinutos: 10,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      expect(result.operadorIds).toContain('op-specialist-1');
      expect(result.slaMinutos).toBe(10);
    });

    it('should apply precedence: specific rules override general', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-all',
          labId: 'lab-123',
          criterioBloco: 'all',
          recipients: {
            operadorIds: ['op-general'],
            telefones: [],
            emails: [],
          },
          slaMinutos: 60,
          ativo: true,
          criadoEm: mockNow,
        },
        {
          id: 'rule-specific',
          labId: 'lab-123',
          criterioBloco: 'byAnalyteAndSeverity',
          analitoIds: ['rbc'],
          severidades: ['alta'],
          recipients: {
            operadorIds: ['op-specialist'],
            telefones: [],
            emails: [],
          },
          slaMinutos: 10,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      // Specific rule should win
      expect(result.operadorIds).toContain('op-specialist');
      expect(result.operadorIds).not.toContain('op-general');
      expect(result.slaMinutos).toBe(10);
    });

    it('should fall back to primary RT if no rules match', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-nomatch',
          labId: 'lab-123',
          criterioBloco: 'byAnalyte',
          analitoIds: ['wbc', 'plt'],
          recipients: {
            operadorIds: ['op-other'],
            telefones: [],
            emails: [],
          },
          slaMinutos: 20,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      expect(result.operadorIds).toEqual([mockPrimaryRtId]);
      expect(result.slaMinutos).toBe(30); // Default SLA
    });

    it('should handle empty rules array', () => {
      const result = getEscalationRecipients(mockCritico, [], mockPrimaryRtId);

      expect(result.operadorIds).toEqual([mockPrimaryRtId]);
      expect(result.telefones).toEqual([]);
      expect(result.emails).toEqual([]);
      expect(result.slaMinutos).toBe(30);
    });

    it('should handle multiple matching rules at same specificity level', () => {
      const rules: RoutingRule[] = [
        {
          id: 'rule-1',
          labId: 'lab-123',
          criterioBloco: 'byAnalyteAndSeverity',
          analitoIds: ['rbc'],
          severidades: ['alta'],
          recipients: {
            operadorIds: ['op-1'],
            telefones: ['555-1111'],
            emails: ['op1@lab.com'],
          },
          slaMinutos: 10,
          ativo: true,
          criadoEm: mockNow,
        },
      ];

      const result = getEscalationRecipients(mockCritico, rules, mockPrimaryRtId);

      // Should take the first matching rule
      expect(result.operadorIds).toContain('op-1');
    });
  });

  describe('mergeEscalationRecipients', () => {
    it('should merge multiple recipient sets without duplicates', () => {
      const recipients = [
        {
          operadorIds: ['op-1', 'op-2'],
          telefones: ['555-1111'],
          emails: ['op1@lab.com'],
          slaMinutos: 10,
        },
        {
          operadorIds: ['op-2', 'op-3'],
          telefones: ['555-1111', '555-2222'],
          emails: ['op2@lab.com'],
          slaMinutos: 20,
        },
      ];

      const result = mergeEscalationRecipients(recipients);

      expect(result.operadorIds).toHaveLength(3);
      expect(result.operadorIds).toContain('op-1');
      expect(result.operadorIds).toContain('op-2');
      expect(result.operadorIds).toContain('op-3');

      expect(result.telefones).toHaveLength(2);
      expect(result.slaMinutos).toBe(20); // Max SLA
    });

    it('should handle empty recipient sets', () => {
      const recipients = [
        {
          operadorIds: [],
          telefones: [],
          emails: [],
          slaMinutos: 30,
        },
      ];

      const result = mergeEscalationRecipients(recipients);

      expect(result.operadorIds).toHaveLength(0);
      expect(result.slaMinutos).toBe(30);
    });

    it('should take maximum SLA from multiple sets', () => {
      const recipients = [
        {
          operadorIds: ['op-1'],
          telefones: [],
          emails: [],
          slaMinutos: 10,
        },
        {
          operadorIds: ['op-2'],
          telefones: [],
          emails: [],
          slaMinutos: 60,
        },
        {
          operadorIds: ['op-3'],
          telefones: [],
          emails: [],
          slaMinutos: 30,
        },
      ];

      const result = mergeEscalationRecipients(recipients);

      expect(result.slaMinutos).toBe(60);
    });
  });
});
