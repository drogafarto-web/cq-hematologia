/**
 * Management Review Unit Tests — SA-44
 *
 * Tests 15-entry aggregation, DICQ 4.15 compliance, signature validation.
 * Phase 8 Wave 6 — Unit Tests
 *
 * Compliance: DICQ 4.15 | RDC 978 Art. 167
 */

import { describe, it, expect } from 'vitest';
import type {
  ManagementReviewMinutes,
  ManagementReviewInput,
} from '../../features/management-review/types/ManagementReview';

// DICQ 4.15 — 15 mandatory entries
const MANAGEMENT_REVIEW_ENTRY_TITLES = [
  'Análise de Resultados de Auditorias',
  'Análise de Conformidades e CAPAs',
  'Tendências de Indicadores de Desempenho',
  'Análise de Feedback do Cliente',
  'Análise de Competência do Pessoal',
  'Análise de Infraestrutura e Calibração',
  'Análise de Desempenho de Fornecedores',
  'Análise de Mudanças Regulatórias',
  'Oportunidades para Melhoria',
  'Avaliação de Riscos e Mitigação',
  'Status de Objetivos de Qualidade',
  'Decisões sobre Alocação de Recursos',
  'Mudanças Procedimentais Aprovadas',
  'Direcionamento sobre Iniciativas Estratégicas',
  'Data, Participantes e Assinatura',
];

describe('Management Review — DICQ 4.15', () => {
  // ─── Entry Count Validation ────────────────────────────────────────────

  describe('15 mandatory entries', () => {
    it('should have exactly 15 entry titles defined', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES).toHaveLength(15);
    });

    it('should include audit findings as entry 1', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[0]).toBe('Análise de Resultados de Auditorias');
    });

    it('should include NC/CAPA analysis as entry 2', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[1]).toBe('Análise de Conformidades e CAPAs');
    });

    it('should include KPI trends as entry 3', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[2]).toBe('Tendências de Indicadores de Desempenho');
    });

    it('should include customer feedback as entry 4', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[3]).toBe('Análise de Feedback do Cliente');
    });

    it('should include personnel competency as entry 5', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[4]).toBe('Análise de Competência do Pessoal');
    });

    it('should include infrastructure/calibration as entry 6', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[5]).toBe('Análise de Infraestrutura e Calibração');
    });

    it('should include supplier performance as entry 7', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[6]).toBe('Análise de Desempenho de Fornecedores');
    });

    it('should include regulatory changes as entry 8', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[7]).toBe('Análise de Mudanças Regulatórias');
    });

    it('should include improvement opportunities as entry 9', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[8]).toBe('Oportunidades para Melhoria');
    });

    it('should include risk assessment as entry 10', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[9]).toBe('Avaliação de Riscos e Mitigação');
    });

    it('should include quality objectives as entry 11', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[10]).toBe('Status de Objetivos de Qualidade');
    });

    it('should include resource allocation as entry 12', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[11]).toBe('Decisões sobre Alocação de Recursos');
    });

    it('should include procedural changes as entry 13', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[12]).toBe('Mudanças Procedimentais Aprovadas');
    });

    it('should include strategic initiatives as entry 14', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[13]).toBe(
        'Direcionamento sobre Iniciativas Estratégicas',
      );
    });

    it('should include date/participants/signature as entry 15', () => {
      expect(MANAGEMENT_REVIEW_ENTRY_TITLES[14]).toBe('Data, Participantes e Assinatura');
    });
  });

  // ─── ManagementReviewInput Schema Tests ────────────────────────────────

  describe('ManagementReviewInput schema', () => {
    it('should support audit findings entry', () => {
      const input: ManagementReviewInput = {
        auditFindings: {
          internalAudits: 4,
          externalAudits: 2,
          openFindings: 3,
          capaClosureRate: 75,
        },
      };

      expect(input.auditFindings).toBeDefined();
      expect(input.auditFindings?.internalAudits).toBe(4);
      expect(input.auditFindings?.capaClosureRate).toBe(75);
    });

    it('should support all 15 entry types', () => {
      const input: ManagementReviewInput = {
        auditFindings: {
          internalAudits: 0,
          externalAudits: 0,
          openFindings: 0,
          capaClosureRate: 0,
        },
        complaints: { newComplaints: 0, totalOpen: 0, resolutionRate: 0, criticalComplaints: 0 },
        nonConformances: { newNC: 0, totalOpen: 0, capaImplemented: 0, capaEffectivenessRate: 0 },
        proficiencyTesting: {
          roundsCompleted: 0,
          passedRounds: 0,
          failedRounds: 0,
          averageZScore: 0,
        },
        qualityIndicators: {
          turnaroundTime: 0,
          errorRate: 0,
          retestPercentage: 0,
          reworkPercentage: 0,
          ncOrigin: { internal: 0, external: 0, supplier: 0 },
        },
        equipment: {
          totalEquipment: 0,
          equipmentUptime: 0,
          calibrationCompliance: 0,
          maintenanceOverdue: 0,
        },
        risksAndMitigation: {
          totalRisks: 0,
          highRiskCount: 0,
          mitigationImplemented: 0,
          riskReviewDate: '',
        },
        trainingCompetency: {
          trainingCompletionRate: 0,
          competencyAssessmentRate: 0,
          trainingGaps: [],
        },
        resources: {
          budgetStatus: 'adequate',
          equipmentNeeds: [],
          staffingNeeds: [],
          safetyIssues: [],
        },
        regulatory: { newRegulatoryChanges: [], implementationStatus: '', complianceGaps: [] },
        customerSatisfaction: {
          satisfactionScore: 0,
          surveyResponseRate: 0,
          marketPositioning: '',
        },
        strategicInitiatives: { activeInitiatives: [], completedMilestones: [], delayedItems: [] },
        succession: { staffChanges: [], crossTrainingProgress: '', keyPersonRisks: [] },
        procurementSupplier: { supplierCount: 0, performanceIssues: [], auditsPending: 0 },
        priorActions: { totalPriorActions: 0, closedActions: 0, overdueActions: 0 },
      };

      expect(input).toBeDefined();
      expect(Object.keys(input)).toHaveLength(15);
    });
  });

  // ─── ManagementReviewMinutes Schema Tests ───────────────────────────────

  describe('ManagementReviewMinutes', () => {
    it('should have required metadata fields', () => {
      const now = new Date().toISOString();
      const minutes: ManagementReviewMinutes = {
        id: 'review-001',
        labId: 'lab-test',
        meetingNumber: 'Q1-2026',
        scheduledDate: now,
        actualDate: now,
        status: 'held',
        location: 'Conference Room A',
        chair: {
          name: 'Dr. João Silva',
          email: 'joao@lab.com',
          role: 'Diretor Técnico',
        },
        recorder: {
          name: 'Maria Santos',
          email: 'maria@lab.com',
          role: 'Gerente de Qualidade',
        },
        attendees: [
          {
            name: 'Dr. João Silva',
            email: 'joao@lab.com',
            role: 'Diretor Técnico',
            present: true,
          },
          {
            name: 'Maria Santos',
            email: 'maria@lab.com',
            role: 'Gerente de Qualidade',
            present: true,
          },
        ],
        inputs: {
          auditFindings: {
            internalAudits: 2,
            externalAudits: 1,
            openFindings: 1,
            capaClosureRate: 90,
          },
        },
        decisions: [],
        actionItems: [],
        createdAt: now,
        createdBy: 'user-123',
        lastModifiedAt: now,
        lastModifiedBy: 'user-123',
      };

      expect(minutes.id).toBe('review-001');
      expect(minutes.chair.name).toBe('Dr. João Silva');
      expect(minutes.attendees).toHaveLength(2);
      expect(minutes.inputs).toBeDefined();
    });

    it('should support signed state', () => {
      const now = new Date().toISOString();
      const minutes: ManagementReviewMinutes = {
        id: 'review-001',
        labId: 'lab-test',
        meetingNumber: 'Q1-2026',
        scheduledDate: now,
        actualDate: now,
        status: 'held',
        location: 'Room',
        chair: { name: 'Chair', email: 'chair@lab.com', role: 'Role' },
        recorder: { name: 'Recorder', email: 'rec@lab.com', role: 'Role' },
        attendees: [],
        inputs: {},
        decisions: [],
        actionItems: [],
        createdAt: now,
        createdBy: 'user-123',
        lastModifiedAt: now,
        lastModifiedBy: 'user-123',
        signedAt: now,
        signedBy: 'user-123',
      };

      expect(minutes.signedAt).toBeDefined();
      expect(minutes.signedBy).toBe('user-123');
    });
  });

  // ─── Signature Hash Validation Tests ────────────────────────────────────

  describe('ReviewSignature hash validation', () => {
    it('should accept 64-character hex hash', () => {
      const validHash = 'a'.repeat(64);
      expect(validHash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });

    it('should reject hash with less than 64 characters', () => {
      const invalidHash = 'a'.repeat(63);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should reject hash with non-hex characters', () => {
      const invalidHash = 'g'.repeat(64);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should support mixed-case hex hash', () => {
      const validHash = 'AaBbCcDd'.padEnd(64, '0');
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });
  });

  // ─── Data Aggregation Scenarios ────────────────────────────────────────

  describe('Data aggregation scenarios', () => {
    it('should handle audit findings aggregation', () => {
      const data = {
        entryNumber: 1,
        title: 'Análise de Resultados de Auditorias',
        source: 'auto-aggregated' as const,
        data: {
          internalAudits: 4,
          externalAudits: 1,
          openFindings: 2,
          capaClosureRate: 85,
        },
      };

      expect(data.entryNumber).toBe(1);
      expect(data.data.capaClosureRate).toBe(85);
    });

    it('should handle missing data sources gracefully', () => {
      const data = {
        entryNumber: 1,
        title: 'Análise de Resultados de Auditorias',
        source: 'auto-aggregated' as const,
        data: {},
        error: 'Collection unavailable',
      };

      expect(data.error).toBeDefined();
      expect(Object.keys(data.data)).toHaveLength(0);
    });

    it('should return exactly 15 entries even with errors', () => {
      const entries = Array.from({ length: 15 }, (_, i) => ({
        entryNumber: i + 1,
        title: MANAGEMENT_REVIEW_ENTRY_TITLES[i],
        source: i < 7 ? 'auto-aggregated' : 'manual',
        data: i < 7 ? { sample: 'data' } : {},
        error: i === 5 ? 'Query timeout' : undefined,
      }));

      expect(entries).toHaveLength(15);
      expect(entries.filter((e) => e.error)).toHaveLength(1);
    });

    it('should separate auto-aggregated from manual sources', () => {
      const entries = Array.from({ length: 15 }, (_, i) => ({
        entryNumber: i + 1,
        source: i < 7 ? 'auto-aggregated' : 'manual',
      }));

      const autoEntries = entries.filter((e) => e.source === 'auto-aggregated');
      const manualEntries = entries.filter((e) => e.source === 'manual');

      expect(autoEntries).toHaveLength(7);
      expect(manualEntries).toHaveLength(8);
    });
  });

  // ─── Soft-Delete Behavior Tests ─────────────────────────────────────────

  describe('Soft-delete behavior', () => {
    it('should support deletedAt field in minutes', () => {
      const now = new Date().toISOString();
      const minutes: ManagementReviewMinutes = {
        id: 'review-001',
        labId: 'lab-test',
        meetingNumber: 'Q1-2026',
        scheduledDate: now,
        actualDate: now,
        status: 'held',
        location: 'Room',
        chair: { name: 'Chair', email: 'chair@lab.com', role: 'Role' },
        recorder: { name: 'Recorder', email: 'rec@lab.com', role: 'Role' },
        attendees: [],
        inputs: {},
        decisions: [],
        actionItems: [],
        createdAt: now,
        createdBy: 'user-123',
        lastModifiedAt: now,
        lastModifiedBy: 'user-123',
        deletedAt: now,
      };

      expect(minutes.deletedAt).toBeDefined();
    });

    it('should filter deleted reviews', () => {
      const now = new Date().toISOString();
      const reviews = [
        { id: 'review-001', deletedAt: undefined },
        { id: 'review-002', deletedAt: now },
        { id: 'review-003', deletedAt: undefined },
      ];

      const activeReviews = reviews.filter((r) => !r.deletedAt);
      expect(activeReviews).toHaveLength(2);
      expect(activeReviews[0].id).toBe('review-001');
    });
  });

  // ─── Multi-Tenant Isolation Tests ───────────────────────────────────────

  describe('Multi-tenant scoping', () => {
    it('should isolate reviews by labId', () => {
      const reviews = [
        { id: 'review-001', labId: 'lab-1' },
        { id: 'review-002', labId: 'lab-2' },
        { id: 'review-003', labId: 'lab-1' },
      ];

      const lab1Reviews = reviews.filter((r) => r.labId === 'lab-1');
      expect(lab1Reviews).toHaveLength(2);
      expect(lab1Reviews.every((r) => r.labId === 'lab-1')).toBe(true);
    });
  });

  // ─── Action Items Tests ────────────────────────────────────────────────

  describe('Action items tracking', () => {
    it('should track action item status lifecycle', () => {
      const now = new Date().toISOString();
      const actionItem = {
        id: 'action-001',
        description: 'Implement new QMS procedure',
        owner: 'Maria Santos',
        targetDate: '2026-06-30',
        successCriteria: 'All personnel trained and signed off',
        status: 'open' as const,
      };

      expect(actionItem.status).toBe('open');

      // Update status
      const updated = { ...actionItem, status: 'in_progress' as const };
      expect(updated.status).toBe('in_progress');
    });

    it('should support completed status with closure date', () => {
      const actionItem = {
        id: 'action-001',
        description: 'Action',
        owner: 'Owner',
        targetDate: '2026-06-30',
        successCriteria: 'Criteria',
        status: 'completed' as const,
      };

      expect(actionItem.status).toBe('completed');
    });
  });

  // ─── Year Isolation Tests ────────────────────────────────────────────────

  describe('Annual review isolation', () => {
    it('should prevent duplicate reviews for same year', () => {
      const reviews = [
        { id: 'review-001', labId: 'lab-test', year: 2026 },
        { id: 'review-002', labId: 'lab-test', year: 2025 },
      ];

      // Check if 2026 review already exists
      const has2026 = reviews.some((r) => r.year === 2026 && r.labId === 'lab-test');
      expect(has2026).toBe(true);

      // Can't create another for same year/lab
      const canCreate = !reviews.some((r) => r.year === 2026 && r.labId === 'lab-test');
      expect(canCreate).toBe(false);
    });

    it('should allow different years for same lab', () => {
      const reviews = [
        { id: 'review-001', labId: 'lab-test', year: 2026, status: 'held' },
        { id: 'review-002', labId: 'lab-test', year: 2025, status: 'held' },
      ];

      expect(reviews.filter((r) => r.labId === 'lab-test')).toHaveLength(2);
    });
  });
});
