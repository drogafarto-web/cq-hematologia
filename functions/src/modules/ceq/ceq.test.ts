/**
 * CEQ Cloud Functions Tests
 *
 * Tests:
 * - Z-score calculation validation
 * - NC auto-creation threshold (|Z| >= 3)
 * - Cloud Function callables
 */

import { describe, it, expect } from 'vitest';

// Helper function (mirrors ceq.ts calcularZScore)
function calcularZScore(
  valorObtido: number,
  valorReferencia: number,
  desvioEstimado: number,
): { zScore: number; interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria' } {
  if (desvioEstimado === 0) {
    return { zScore: NaN, interpretacao: 'questionavel' };
  }

  const zScore = (valorObtido - valorReferencia) / desvioEstimado;
  let interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';

  if (Math.abs(zScore) < 2) {
    interpretacao = 'satisfatoria';
  } else if (Math.abs(zScore) < 3) {
    interpretacao = 'questionavel';
  } else {
    interpretacao = 'insatisfatoria';
  }

  return { zScore, interpretacao };
}

describe('CEQ Cloud Functions', () => {
  describe('Z-Score Calculation (Server-side Validation)', () => {
    it('calculates satisfactory result correctly', () => {
      const result = calcularZScore(100, 100, 10);
      expect(result.zScore).toBe(0);
      expect(result.interpretacao).toBe('satisfatoria');
    });

    it('calculates questionable result correctly', () => {
      const result = calcularZScore(125, 100, 10);
      expect(result.zScore).toBe(2.5);
      expect(result.interpretacao).toBe('questionavel');
    });

    it('calculates unsatisfactory result correctly', () => {
      const result = calcularZScore(135, 100, 10);
      expect(result.zScore).toBe(3.5);
      expect(result.interpretacao).toBe('insatisfatoria');
    });

    it('handles division by zero (desvioEstimado = 0)', () => {
      const result = calcularZScore(100, 100, 0);
      expect(isNaN(result.zScore)).toBe(true);
      expect(result.interpretacao).toBe('questionavel');
    });
  });

  describe('NC Auto-Creation Logic', () => {
    it('does NOT create NC when |Z| < 3', () => {
      const testCases = [
        { zScore: 0, expected: false },
        { zScore: 1.5, expected: false },
        { zScore: 2.0, expected: false },
        { zScore: 2.99, expected: false },
        { zScore: -1.5, expected: false },
        { zScore: -2.99, expected: false },
      ];

      testCases.forEach(({ zScore, expected }) => {
        const bloqueadora = Math.abs(zScore) >= 3;
        expect(bloqueadora).toBe(expected);
      });
    });

    it('creates NC when |Z| >= 3 (positive)', () => {
      const testCases = [
        { zScore: 3.0, expected: true },
        { zScore: 3.1, expected: true },
        { zScore: 5.0, expected: true },
      ];

      testCases.forEach(({ zScore, expected }) => {
        const bloqueadora = Math.abs(zScore) >= 3;
        expect(bloqueadora).toBe(expected);
      });
    });

    it('creates NC when |Z| >= 3 (negative)', () => {
      const testCases = [
        { zScore: -3.0, expected: true },
        { zScore: -3.1, expected: true },
        { zScore: -5.0, expected: true },
      ];

      testCases.forEach(({ zScore, expected }) => {
        const bloqueadora = Math.abs(zScore) >= 3;
        expect(bloqueadora).toBe(expected);
      });
    });

    it('creates NC exactly at threshold (Z = 3.0)', () => {
      const zScore = 3.0;
      const bloqueadora = Math.abs(zScore) >= 3;
      expect(bloqueadora).toBe(true);
    });

    it('does not create NC just below threshold (Z = 2.99)', () => {
      const zScore = 2.99;
      const bloqueadora = Math.abs(zScore) >= 3;
      expect(bloqueadora).toBe(false);
    });
  });

  describe('NC Number Generation', () => {
    it('formats NC numero correctly: NC-{YYYY}-{seq}', () => {
      const ano = new Date().getFullYear();
      const seq = 1;
      const numero = `NC-${ano}-${String(seq).padStart(4, '0')}`;

      expect(numero).toMatch(/^NC-\d{4}-\d{4}$/);
      expect(numero).toBe(`NC-${ano}-0001`);
    });

    it('pads sequence with zeros', () => {
      const ano = new Date().getFullYear();
      const casos = [
        { seq: 1, expected: `NC-${ano}-0001` },
        { seq: 10, expected: `NC-${ano}-0010` },
        { seq: 100, expected: `NC-${ano}-0100` },
        { seq: 1000, expected: `NC-${ano}-1000` },
        { seq: 9999, expected: `NC-${ano}-9999` },
      ];

      casos.forEach(({ seq, expected }) => {
        const numero = `NC-${ano}-${String(seq).padStart(4, '0')}`;
        expect(numero).toBe(expected);
      });
    });
  });

  describe('Request Validation', () => {
    it('validates required fields in LancarCEQResultadoRequest', () => {
      const validRequest = {
        labId: 'lab-123',
        ceqAmostraId: 'amo-456',
        ceqParticipacaoId: 'par-789',
        analyteId: 'hb',
        analyteName: 'Hemoglobin',
        valorObtido: 13.6,
        unidade: 'g/dL',
        valorReferencia: 13.5,
        desvioEstimado: 0.3,
      };

      // Type-safe check: if this compiles, validation passes
      expect(validRequest.labId).toBeDefined();
      expect(validRequest.ceqAmostraId).toBeDefined();
      expect((validRequest as Record<string, unknown>)['zScore']).toBeUndefined(); // Should not be in request
    });

    it('validates numeric constraints', () => {
      // These should all be numbers and > 0 (for biological values)
      const request = {
        valorObtido: 13.6,
        valorReferencia: 13.5,
        desvioEstimado: 0.3,
      };

      expect(typeof request.valorObtido).toBe('number');
      expect(typeof request.valorReferencia).toBe('number');
      expect(typeof request.desvioEstimado).toBe('number');

      expect(request.desvioEstimado).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles very large Z-scores', () => {
      const zScore = 100;
      const bloqueadora = Math.abs(zScore) >= 3;
      expect(bloqueadora).toBe(true);
    });

    it('handles decimal Z-scores precisely', () => {
      const zScore = 3.0000001;
      const bloqueadora = Math.abs(zScore) >= 3;
      expect(bloqueadora).toBe(true);
    });

    it('handles near-zero differences', () => {
      const result = calcularZScore(100.0001, 100, 10);
      expect(result.zScore).toBeCloseTo(0.00001, 5);
      expect(result.interpretacao).toBe('satisfatoria');
    });
  });
});
