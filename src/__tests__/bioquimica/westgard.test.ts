/**
 * src/__tests__/bioquimica/westgard.test.ts
 *
 * 16 unit tests for CLSI 8-rule Westgard engine.
 * 2 tests per rule (positive + negative case).
 */

import { describe, it, expect } from 'vitest';
import {
  detect_1_3s,
  detect_2_2s,
  detect_R_4s,
  detect_4_1s,
  detect_10x,
  detect_7T,
  detect_8x,
  detect_12x,
} from '../../features/bioquimica/services/westgardEngine';
import type { WestgardObservation } from '../../features/bioquimica/types/westgardCLSI';

// ─── Helper ───────────────────────────────────────────────────────────────

function createObs(
  id: string,
  zScore: number,
  tsOffset: number = 0
): WestgardObservation {
  return {
    runId: `run-${id}`,
    analitoId: 'test-analito',
    equipmentId: 'eq-1',
    nivelId: 'nivel-2',
    value: 100 + zScore * 5,
    mean: 100,
    sd: 5,
    zScore,
    ts: 1000000 + tsOffset,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Westgard CLSI 8-Rule Engine', () => {
  // ──── 1-3s ────────────────────────────────────────────────────────────

  describe('detect_1_3s', () => {
    it('should detect single result > +3 SD', () => {
      const obs = [createObs('1', 3.5)];
      const violations = detect_1_3s(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('1-3s');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect result at +2.9 SD', () => {
      const obs = [createObs('1', 2.9)];
      const violations = detect_1_3s(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 2-2s ────────────────────────────────────────────────────────────

  describe('detect_2_2s', () => {
    it('should detect 2 consecutive above +2 SD', () => {
      const obs = [createObs('1', 2.3, 0), createObs('2', 2.5, 1000)];
      const violations = detect_2_2s(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('2-2s');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect if one inside and one outside', () => {
      const obs = [createObs('1', 1.9, 0), createObs('2', 2.5, 1000)];
      const violations = detect_2_2s(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── R-4s ────────────────────────────────────────────────────────────

  describe('detect_R_4s', () => {
    it('should detect range > 4 SD between consecutive', () => {
      const obs = [createObs('1', 2.1, 0), createObs('2', -2.3, 1000)];
      const violations = detect_R_4s(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('R-4s');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect range 3.8 SD', () => {
      const obs = [createObs('1', 1.9, 0), createObs('2', -1.9, 1000)];
      const violations = detect_R_4s(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 4-1s ────────────────────────────────────────────────────────────

  describe('detect_4_1s', () => {
    it('should detect 4 consecutive same-side > 1 SD', () => {
      const obs = [
        createObs('1', 1.5, 0),
        createObs('2', 1.3, 1000),
        createObs('3', 1.8, 2000),
        createObs('4', 1.2, 3000),
      ];
      const violations = detect_4_1s(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('4-1s');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect if one crosses zero', () => {
      const obs = [
        createObs('1', 1.5, 0),
        createObs('2', 1.3, 1000),
        createObs('3', -0.5, 2000),
        createObs('4', 1.2, 3000),
      ];
      const violations = detect_4_1s(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 10x ────────────────────────────────────────────────────────────

  describe('detect_10x', () => {
    it('should detect 10 consecutive same-side', () => {
      const obs = Array.from({ length: 10 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_10x(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('10x');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect 9 same-side', () => {
      const obs = Array.from({ length: 9 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_10x(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 7T ────────────────────────────────────────────────────────────

  describe('detect_7T', () => {
    it('should detect 7 consecutive monotonic ascending', () => {
      const obs = Array.from({ length: 7 }, (_, i) =>
        createObs(i.toString(), i * 0.3, i * 1000)
      );
      const violations = detect_7T(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('7T');
      expect(violations[0].severity).toBe('reject');
    });

    it('should not detect 6 ascending + 1 reverse', () => {
      const obs = [
        createObs('1', 0, 0),
        createObs('2', 0.3, 1000),
        createObs('3', 0.6, 2000),
        createObs('4', 0.9, 3000),
        createObs('5', 1.2, 4000),
        createObs('6', 1.5, 5000),
        createObs('7', 1.2, 6000), // reverse
      ];
      const violations = detect_7T(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 8x ────────────────────────────────────────────────────────────

  describe('detect_8x', () => {
    it('should detect 8 consecutive same-side (warn)', () => {
      const obs = Array.from({ length: 8 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_8x(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('8x');
      expect(violations[0].severity).toBe('warn');
    });

    it('should not detect 7 same-side', () => {
      const obs = Array.from({ length: 7 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_8x(obs);
      expect(violations).toHaveLength(0);
    });
  });

  // ──── 12x ───────────────────────────────────────────────────────────

  describe('detect_12x', () => {
    it('should detect 12 consecutive same-side (warn)', () => {
      const obs = Array.from({ length: 12 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_12x(obs);
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('12x');
      expect(violations[0].severity).toBe('warn');
    });

    it('should not detect 11 same-side', () => {
      const obs = Array.from({ length: 11 }, (_, i) =>
        createObs(i.toString(), 0.5, i * 1000)
      );
      const violations = detect_12x(obs);
      expect(violations).toHaveLength(0);
    });
  });
});
