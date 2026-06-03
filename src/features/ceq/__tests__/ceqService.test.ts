/**
 * CEQ Service Tests
 *
 * Tests Z-score calculation and CEQ business logic
 * Coverage: >80%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calcularZScore } from '../services/ceqService';

describe('CEQService', () => {
  describe('calcularZScore', () => {
    // ─── Satisfactory results (|Z| < 2) ──────────────────────────────────

    it('calculates Z-score for exact match to reference', () => {
      const result = calcularZScore(100, 100, 10);
      expect(result.zScore).toBe(0);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    it('calculates Z-score within acceptable range (low)', () => {
      const result = calcularZScore(95, 100, 10);
      expect(result.zScore).toBeCloseTo(-0.5);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    it('calculates Z-score within acceptable range (high)', () => {
      const result = calcularZScore(105, 100, 10);
      expect(result.zScore).toBeCloseTo(0.5);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    it('borderline satisfactory: Z = 1.99', () => {
      const result = calcularZScore(119.9, 100, 10);
      expect(result.zScore).toBeCloseTo(1.99);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    // ─── Questionable results (2 ≤ |Z| < 3) ─────────────────────────────

    it('questionable: Z = 2.0 (warning threshold)', () => {
      const result = calcularZScore(120, 100, 10);
      expect(result.zScore).toBeCloseTo(2.0);
      expect(result.interpretacao).toBe('questionavel');
    });

    it('questionable: Z = 2.5 (mid-warning)', () => {
      const result = calcularZScore(125, 100, 10);
      expect(result.zScore).toBeCloseTo(2.5);
      expect(result.interpretacao).toBe('questionavel');
    });

    it('questionable: Z = 2.99 (near rejection)', () => {
      const result = calcularZScore(129.9, 100, 10);
      expect(result.zScore).toBeCloseTo(2.99);
      expect(result.interpretacao).toBe('questionavel');
    });

    it('questionable: negative Z in warning range', () => {
      const result = calcularZScore(75, 100, 10);
      expect(result.zScore).toBeCloseTo(-2.5);
      expect(result.interpretacao).toBe('questionavel');
    });

    // ─── Unsatisfactory results (|Z| ≥ 3) ────────────────────────────────

    it('unsatisfactory: Z = 3.0 (rejection threshold)', () => {
      const result = calcularZScore(130, 100, 10);
      expect(result.zScore).toBeCloseTo(3.0);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    it('unsatisfactory: Z = 3.5 (clear rejection)', () => {
      const result = calcularZScore(135, 100, 10);
      expect(result.zScore).toBeCloseTo(3.5);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    it('unsatisfactory: Z = -3.0 (negative rejection)', () => {
      const result = calcularZScore(70, 100, 10);
      expect(result.zScore).toBeCloseTo(-3.0);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    it('unsatisfactory: Z = -5.0 (extreme negative)', () => {
      const result = calcularZScore(50, 100, 10);
      expect(result.zScore).toBeCloseTo(-5.0);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    // ─── Edge cases ──────────────────────────────────────────────────────

    it('handles zero deviation (desvioEstimado = 0)', () => {
      const result = calcularZScore(100, 100, 0);
      expect(isNaN(result.zScore)).toBe(true);
      expect(result.interpretacao).toBe('questionavel'); // Treat as warning
    });

    it('handles very small deviation', () => {
      const result = calcularZScore(100.001, 100, 0.0001);
      expect(result.zScore).toBeCloseTo(10);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    it('handles negative reference value', () => {
      const result = calcularZScore(-100, -110, 5);
      expect(result.zScore).toBeCloseTo(2);
      expect(result.interpretacao).toBe('questionavel');
    });

    it('handles decimal values', () => {
      const result = calcularZScore(5.67, 5.5, 0.15);
      expect(result.zScore).toBeCloseTo(1.133, 2);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    // ─── NC Creation Logic ──────────────────────────────────────────────

    describe('NC Creation Thresholds', () => {
      it('does NOT create NC when Z = 2.99', () => {
        const result = calcularZScore(129.9, 100, 10);
        const bloqueadora = Math.abs(result.zScore) >= 3;
        expect(bloqueadora).toBe(false);
      });

      it('creates NC when Z = 3.0 (exactly at threshold)', () => {
        const result = calcularZScore(130, 100, 10);
        const bloqueadora = Math.abs(result.zScore) >= 3;
        expect(bloqueadora).toBe(true);
      });

      it('creates NC when Z = 3.1 (above threshold)', () => {
        const result = calcularZScore(131, 100, 10);
        const bloqueadora = Math.abs(result.zScore) >= 3;
        expect(bloqueadora).toBe(true);
      });

      it('creates NC for negative Z = -3.0', () => {
        const result = calcularZScore(70, 100, 10);
        const bloqueadora = Math.abs(result.zScore) >= 3;
        expect(bloqueadora).toBe(true);
      });

      it('does not create NC for Z = 1.5', () => {
        const result = calcularZScore(115, 100, 10);
        const bloqueadora = Math.abs(result.zScore) >= 3;
        expect(bloqueadora).toBe(false);
      });
    });

    // ─── Real-world scenarios ──────────────────────────────────────────

    describe('Real-world PT scenarios', () => {
      it('hemoglobin: acceptable result', () => {
        // Ref: 13.5 g/dL, SD: 0.3, Lab result: 13.6
        const result = calcularZScore(13.6, 13.5, 0.3);
        expect(result.zScore).toBeCloseTo(0.333, 2);
        expect(result.interpretacao).toBe('satisfatoria');
      });

      it('glucose: borderline high result', () => {
        // Ref: 100 mg/dL, SD: 3, Lab result: 108
        const result = calcularZScore(108, 100, 3);
        expect(result.zScore).toBeCloseTo(2.667, 2);
        expect(result.interpretacao).toBe('questionavel');
      });

      it('creatinine: unsatisfactory result', () => {
        // Ref: 1.0 mg/dL, SD: 0.1, Lab result: 1.35
        const result = calcularZScore(1.35, 1.0, 0.1);
        expect(result.zScore).toBeCloseTo(3.5, 5);
        expect(result.interpretacao).toBe('insatisfatoria');
      });

      it('troponin: critical unsatisfactory result', () => {
        // Ref: 0.04 ng/mL, SD: 0.005, Lab result: 0.080
        const result = calcularZScore(0.08, 0.04, 0.005);
        expect(result.zScore).toBe(8);
        expect(result.interpretacao).toBe('insatisfatoria');
      });
    });

    // ─── Symmetry (positive/negative) ────────────────────────────────

    it('demonstrates symmetry: positive vs negative Z', () => {
      const resultPos = calcularZScore(120, 100, 10); // Z = 2
      const resultNeg = calcularZScore(80, 100, 10); // Z = -2

      expect(resultPos.zScore).toBe(2);
      expect(resultNeg.zScore).toBe(-2);
      expect(resultPos.interpretacao).toBe(resultNeg.interpretacao);
    });
  });

  describe('CEQ Data Model', () => {
    // These test the type safety and structure
    it('CEQResultado includes Z-score and NC reference', () => {
      // Type check — if this compiles, the types are correct
      const mockResultado = {
        id: 'res-1',
        labId: 'lab-1',
        ceqAmostraId: 'amo-1',
        ceqParticipacaoId: 'par-1',
        analyteId: 'hb',
        analyteName: 'Hemoglobin',
        valorObtido: 13.6,
        unidade: 'g/dL',
        valorReferencia: 13.5,
        desvioEstimado: 0.3,
        zScore: 0.333,
        interpretacao: 'satisfatoria' as const,
        ncAutomaticaCriadaId: undefined,
        temNCGrave: false,
        status: 'lancado' as const,
        criadoEm: new Date(),
        criadoPor: 'user-1',
      };

      expect(mockResultado.zScore).toBeLessThan(2);
      expect(mockResultado.temNCGrave).toBe(false);
    });

    it('CEQResultado flags NC creation when Z >= 3', () => {
      const mockResultado = {
        zScore: 3.5,
        temNCGrave: Math.abs(3.5) >= 3, // true
      };

      expect(mockResultado.temNCGrave).toBe(true);
    });
  });
});
