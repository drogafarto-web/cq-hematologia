import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  checkWestgardCLSI,
  suggestStatus,
  WestgardCheckInput,
} from '../utils/westgardRulesCLSI';

describe('westgardRulesCLSI', () => {
  const baseInput: Omit<WestgardCheckInput, 'current' | 'history' | 'stats'> = {};
  const now = Timestamp.now();

  // Rule 1-2s: warn (1 point beyond 2σ)
  describe('Rule 1-2s (warn)', () => {
    it('should trigger 1-2s warn for value > 2σ and ≤ 3σ', () => {
      const input: WestgardCheckInput = {
        current: {
          value: 102.5,
          analitoId: 'glucose',
          nivelId: 'normal',
          equipmentId: 'eq1',
          capturaEm: now,
        },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('1-2s');
      expect(violations[0].severity).toBe('warn');
    });

    it('should trigger 1-2s for negative deviation > 2σ', () => {
      const input: WestgardCheckInput = {
        current: { value: 97.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('1-2s');
    });
  });

  // Rule 1-3s: reject (1 point beyond 3σ)
  describe('Rule 1-3s (reject)', () => {
    it('should trigger 1-3s reject for value > 3σ', () => {
      const input: WestgardCheckInput = {
        current: { value: 103.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === '1-3s' && v.severity === 'reject')).toBe(
        true
      );
    });

    it('should not trigger 1-2s when 1-3s is triggered', () => {
      const input: WestgardCheckInput = {
        current: { value: 103.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      const has1_2s = violations.some((v) => v.rule === '1-2s');
      expect(has1_2s).toBe(false);
    });
  });

  // Rule 2-2s: reject (2 consecutive runs same side > 2σ)
  describe('Rule 2-2s (reject)', () => {
    it('should trigger 2-2s for 2 consecutive runs same side beyond 2σ', () => {
      const input: WestgardCheckInput = {
        current: { value: 102.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [{ value: 102.2, capturaEm: Timestamp.fromDate(new Date(now.toDate().getTime() - 1000)) }],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === '2-2s')).toBe(true);
    });

    it('should not trigger 2-2s for runs on opposite sides', () => {
      const input: WestgardCheckInput = {
        current: { value: 102.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [{ value: 97.5, capturaEm: Timestamp.fromDate(new Date(now.toDate().getTime() - 1000)) }],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === '2-2s')).toBe(false);
    });
  });

  // Rule R-4s: reject (range 4σ between 2 consecutive runs)
  describe('Rule R-4s (reject)', () => {
    it('should trigger R-4s for range > 4σ between consecutive runs', () => {
      const input: WestgardCheckInput = {
        current: { value: 104.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [{ value: 100.3, capturaEm: Timestamp.fromDate(new Date(now.toDate().getTime() - 1000)) }],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === 'R-4s')).toBe(true);
    });

    it('should not trigger R-4s for range ≤ 4σ', () => {
      const input: WestgardCheckInput = {
        current: { value: 103.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [{ value: 99.8, capturaEm: Timestamp.fromDate(new Date(now.toDate().getTime() - 1000)) }],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === 'R-4s')).toBe(false);
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('should return empty array for sd = 0', () => {
      const input: WestgardCheckInput = {
        current: { value: 100.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 0 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toEqual([]);
    });

    it('should return empty array for NaN mean', () => {
      const input: WestgardCheckInput = {
        current: { value: 100.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: NaN, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toEqual([]);
    });

    it('should return empty array for negative sd', () => {
      const input: WestgardCheckInput = {
        current: { value: 100.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: -1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toEqual([]);
    });

    it('should handle empty history', () => {
      const input: WestgardCheckInput = {
        current: { value: 100.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      // Should only check 1-2s and 1-3s, not 2-2s or R-4s
      expect(violations.every((v) => v.rule === '1-2s' || v.rule === '1-3s')).toBe(true);
    });

    it('should handle very high z-scores (> 10)', () => {
      const input: WestgardCheckInput = {
        current: { value: 150, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations.some((v) => v.rule === '1-3s')).toBe(true);
    });

    it('should handle compliant value (within ±1σ)', () => {
      const input: WestgardCheckInput = {
        current: { value: 100.5, analitoId: 'glucose', nivelId: 'normal', equipmentId: 'eq1', capturaEm: now },
        history: [],
        stats: { mean: 100, sd: 1 },
      };

      const violations = checkWestgardCLSI(input);
      expect(violations).toEqual([]);
    });
  });

  // suggestStatus tests
  describe('suggestStatus', () => {
    it('should return Aprovada for no violations', () => {
      const status = suggestStatus([]);
      expect(status).toBe('Aprovada');
    });

    it('should return Aprovada for only warn violations', () => {
      const violations = [{ rule: '1-2s' as const, severity: 'warn' as const, detail: 'test' }];
      const status = suggestStatus(violations);
      expect(status).toBe('Aprovada');
    });

    it('should return Rejeitada for any reject violation', () => {
      const violations = [{ rule: '1-3s' as const, severity: 'reject' as const, detail: 'test' }];
      const status = suggestStatus(violations);
      expect(status).toBe('Rejeitada');
    });

    it('should return Rejeitada even with mixed warn and reject', () => {
      const violations = [
        { rule: '1-2s' as const, severity: 'warn' as const, detail: 'test' },
        { rule: '1-3s' as const, severity: 'reject' as const, detail: 'test' },
      ];
      const status = suggestStatus(violations);
      expect(status).toBe('Rejeitada');
    });
  });
});
