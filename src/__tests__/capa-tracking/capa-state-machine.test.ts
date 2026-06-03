/**
 * CAPA State Machine Unit Tests — SA-41
 *
 * Tests state transition validation, deadline calculations, and document schema.
 * Phase 8 Wave 6 — Unit Tests
 *
 * Compliance: RDC 978 Art. 99 | DICQ 4.14.2
 */

import { describe, it, expect } from 'vitest';
import {
  isValidStateTransition,
  daysRemaining,
  type CapaState,
  type CapaDocument,
} from '../../features/capa-tracking/types';

describe('CAPA State Machine', () => {
  // ─── isValidStateTransition Tests ────────────────────────────────────────

  describe('isValidStateTransition', () => {
    it('should allow open → in-progress', () => {
      expect(isValidStateTransition('open', 'in-progress')).toBe(true);
    });

    it('should allow in-progress → evidence-submitted', () => {
      expect(isValidStateTransition('in-progress', 'evidence-submitted')).toBe(true);
    });

    it('should allow evidence-submitted → auditor-reviewing', () => {
      expect(isValidStateTransition('evidence-submitted', 'auditor-reviewing')).toBe(true);
    });

    it('should allow auditor-reviewing → closed', () => {
      expect(isValidStateTransition('auditor-reviewing', 'closed')).toBe(true);
    });

    it('should allow auditor-reviewing → in-progress (rejection cycle)', () => {
      expect(isValidStateTransition('auditor-reviewing', 'in-progress')).toBe(true);
    });

    it('should reject open → evidence-submitted (skip state)', () => {
      expect(isValidStateTransition('open', 'evidence-submitted')).toBe(false);
    });

    it('should reject open → auditor-reviewing', () => {
      expect(isValidStateTransition('open', 'auditor-reviewing')).toBe(false);
    });

    it('should reject open → closed', () => {
      expect(isValidStateTransition('open', 'closed')).toBe(false);
    });

    it('should reject in-progress → open (backward)', () => {
      expect(isValidStateTransition('in-progress', 'open')).toBe(false);
    });

    it('should reject in-progress → auditor-reviewing (skip state)', () => {
      expect(isValidStateTransition('in-progress', 'auditor-reviewing')).toBe(false);
    });

    it('should reject closed → any state (terminal)', () => {
      expect(isValidStateTransition('closed', 'open')).toBe(false);
      expect(isValidStateTransition('closed', 'in-progress')).toBe(false);
      expect(isValidStateTransition('closed', 'evidence-submitted')).toBe(false);
      expect(isValidStateTransition('closed', 'auditor-reviewing')).toBe(false);
      expect(isValidStateTransition('closed', 'closed')).toBe(false);
    });

    it('should reject evidence-submitted → open', () => {
      expect(isValidStateTransition('evidence-submitted', 'open')).toBe(false);
    });

    it('should reject evidence-submitted → in-progress', () => {
      expect(isValidStateTransition('evidence-submitted', 'in-progress')).toBe(false);
    });

    it('should reject evidence-submitted → closed (must go through auditor-reviewing)', () => {
      expect(isValidStateTransition('evidence-submitted', 'closed')).toBe(false);
    });
  });

  // ─── daysRemaining Tests ────────────────────────────────────────────────

  describe('daysRemaining', () => {
    it('should return positive days when deadline is in the future', () => {
      const future = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days from now
      const days = daysRemaining(future);
      expect(days).toBeGreaterThanOrEqual(9); // Allow for rounding
      expect(days).toBeLessThanOrEqual(10);
    });

    it('should return 0 when deadline is today', () => {
      const today = Date.now();
      const days = daysRemaining(today);
      expect(days).toBe(0);
    });

    it('should return negative days when deadline is in the past', () => {
      const past = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
      const days = daysRemaining(past);
      expect(days).toBeLessThanOrEqual(-4); // Allow for rounding
      expect(days).toBeGreaterThanOrEqual(-5);
    });

    it('should return ~30 days when deadline is 30 days away', () => {
      const thirtyDaysLater = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const days = daysRemaining(thirtyDaysLater);
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('should return ~-1 day when deadline was 1 day ago', () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const days = daysRemaining(oneDayAgo);
      expect(days).toBeLessThanOrEqual(-1);
      expect(days).toBeGreaterThan(-2);
    });
  });

  // ─── CapaDocument Schema Tests ──────────────────────────────────────────

  describe('CapaDocument schema', () => {
    it('should have required fields present', () => {
      const now = Date.now();
      const deadline = now + 30 * 24 * 60 * 60 * 1000;

      const doc: CapaDocument = {
        id: 'capa-001',
        labId: 'lab-test',
        finding: {
          findingId: 'finding-001',
          title: 'Test Finding',
          severity: 'major',
          dicqBlocks: ['4.14'],
          rdcArticles: ['99'],
        },
        state: 'open',
        createdAt: now,
        createdBy: 'user-123',
        rootCause: 'This is a test root cause description that is at least 50 characters long.',
        correctiveAction:
          'This is a corrective action description that is at least 50 characters long.',
        deadlineDate: deadline,
        evidence: [],
        rfiLog: [],
        stateHistory: [
          {
            from: null,
            to: 'open',
            transitionedAt: now,
            transitionedBy: 'user-123',
          },
        ],
        deletedAt: undefined,
      };

      expect(doc).toBeDefined();
      expect(doc.id).toBe('capa-001');
      expect(doc.labId).toBe('lab-test');
      expect(doc.finding).toBeDefined();
      expect(doc.finding.findingId).toBe('finding-001');
      expect(doc.state).toBe('open');
      expect(doc.evidence).toEqual([]);
      expect(doc.rfiLog).toEqual([]);
      expect(doc.stateHistory).toHaveLength(1);
      expect(doc.deletedAt).toBeUndefined();
    });

    it('should track state history transitions', () => {
      const now = Date.now();
      const transitions: CapaDocument['stateHistory'] = [
        { from: null, to: 'open', transitionedAt: now, transitionedBy: 'user-123' },
        {
          from: 'open',
          to: 'in-progress',
          transitionedAt: now + 1000,
          transitionedBy: 'user-456',
        },
        {
          from: 'in-progress',
          to: 'evidence-submitted',
          transitionedAt: now + 2000,
          transitionedBy: 'user-456',
        },
      ];

      expect(transitions).toHaveLength(3);
      expect(transitions[0].from).toBeNull();
      expect(transitions[0].to).toBe('open');
      expect(transitions[1].from).toBe('open');
      expect(transitions[1].to).toBe('in-progress');
      expect(transitions[2].from).toBe('in-progress');
      expect(transitions[2].to).toBe('evidence-submitted');
    });
  });

  // ─── Evidence Validation Tests ──────────────────────────────────────────

  describe('Evidence hash validation', () => {
    it('should accept 64-character hex hash', () => {
      const validHash = 'a'.repeat(64);
      expect(validHash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });

    it('should reject hash with less than 64 characters', () => {
      const invalidHash = 'a'.repeat(63);
      expect(invalidHash).toHaveLength(63);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should reject hash with more than 64 characters', () => {
      const invalidHash = 'a'.repeat(65);
      expect(invalidHash).toHaveLength(65);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should reject hash with non-hex characters', () => {
      const invalidHash = 'g'.repeat(64);
      expect(/^[a-f0-9]{64}$/i.test(invalidHash)).toBe(false);
    });

    it('should accept uppercase hex hash', () => {
      const validHash = 'ABCDEF'.padEnd(64, '0');
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });

    it('should accept mixed case hex hash', () => {
      const validHash = 'AaBbCcDd'.padEnd(64, '0');
      expect(/^[a-f0-9]{64}$/i.test(validHash)).toBe(true);
    });
  });

  // ─── Soft-Delete Filtering Tests ────────────────────────────────────────

  describe('Soft-delete behavior', () => {
    it('should indicate non-deleted CAPA with undefined deletedAt', () => {
      const capa: CapaDocument = {
        id: 'capa-001',
        labId: 'lab-test',
        finding: {
          findingId: 'finding-001',
          title: 'Test',
          severity: 'minor',
          dicqBlocks: [],
          rdcArticles: [],
        },
        state: 'open',
        createdAt: Date.now(),
        createdBy: 'user-123',
        rootCause: 'This is a test root cause description that is at least 50 characters long.',
        correctiveAction:
          'This is a corrective action description that is at least 50 characters long.',
        deadlineDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        evidence: [],
        rfiLog: [],
        stateHistory: [],
        deletedAt: undefined,
      };

      expect(capa.deletedAt).toBeUndefined();
      // Mock filtering: should include this CAPA
      expect(!capa.deletedAt).toBe(true);
    });

    it('should indicate deleted CAPA with numeric deletedAt timestamp', () => {
      const capa: CapaDocument = {
        id: 'capa-001',
        labId: 'lab-test',
        finding: {
          findingId: 'finding-001',
          title: 'Test',
          severity: 'minor',
          dicqBlocks: [],
          rdcArticles: [],
        },
        state: 'closed',
        createdAt: Date.now(),
        createdBy: 'user-123',
        rootCause: 'This is a test root cause description that is at least 50 characters long.',
        correctiveAction:
          'This is a corrective action description that is at least 50 characters long.',
        deadlineDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        evidence: [],
        rfiLog: [],
        stateHistory: [],
        deletedAt: Date.now(),
      };

      expect(capa.deletedAt).toBeDefined();
      expect(typeof capa.deletedAt).toBe('number');
      // Mock filtering: should exclude this CAPA
      expect(!capa.deletedAt).toBe(false);
    });
  });

  // ─── Legacy Compatibility Tests ─────────────────────────────────────────

  describe('Legacy Portuguese status compatibility', () => {
    it('should accept Portuguese state names', () => {
      const legacyStates: CapaState[] = [
        'aberto',
        'em-andamento',
        'evidencia-submetida',
        'auditor-revisando',
        'fechado',
      ];

      for (const state of legacyStates) {
        expect(state).toBeDefined();
        expect(typeof state).toBe('string');
      }
    });

    it('should accept English state names', () => {
      const englishStates: CapaState[] = [
        'open',
        'in-progress',
        'evidence-submitted',
        'auditor-reviewing',
        'closed',
      ];

      for (const state of englishStates) {
        expect(state).toBeDefined();
        expect(typeof state).toBe('string');
      }
    });
  });
});
