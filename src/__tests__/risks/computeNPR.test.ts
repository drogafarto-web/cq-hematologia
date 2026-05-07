import { describe, it, expect } from 'vitest';
import { computeNPR, deriveNivel, DEFAULT_NPR_THRESHOLDS } from '../../features/risks/services/risksService';

describe('computeNPR', () => {
  it('computes 1×1×1 = 1', () => {
    expect(computeNPR(1, 1, 1)).toBe(1);
  });

  it('computes 5×5×5 = 125', () => {
    expect(computeNPR(5, 5, 5)).toBe(125);
  });

  it('computes 2×3×4 = 24', () => {
    expect(computeNPR(2, 3, 4)).toBe(24);
  });

  it('computes 3×3×3 = 27', () => {
    expect(computeNPR(3, 3, 3)).toBe(27);
  });

  it('throws on probabilidade out of range (0)', () => {
    expect(() => computeNPR(0, 2, 2)).toThrow(/Probabilidade/);
  });

  it('throws on severidade out of range (6)', () => {
    expect(() => computeNPR(2, 6, 2)).toThrow(/Severidade/);
  });

  it('throws on deteccao out of range (-1)', () => {
    expect(() => computeNPR(2, 2, -1)).toThrow(/Detecção/);
  });

  it('throws on all factors out of range', () => {
    expect(() => computeNPR(10, 10, 10)).toThrow();
  });
});

describe('deriveNivel', () => {
  const thresholds = DEFAULT_NPR_THRESHOLDS; // 25, 61, 100

  it('returns "baixo" for NPR ≤ 24', () => {
    expect(deriveNivel(1, thresholds)).toBe('baixo');
    expect(deriveNivel(24, thresholds)).toBe('baixo');
  });

  it('returns "medio" for 25 ≤ NPR ≤ 60', () => {
    expect(deriveNivel(25, thresholds)).toBe('medio');
    expect(deriveNivel(42, thresholds)).toBe('medio');
    expect(deriveNivel(60, thresholds)).toBe('medio');
  });

  it('returns "alto" for 61 ≤ NPR ≤ 99', () => {
    expect(deriveNivel(61, thresholds)).toBe('alto');
    expect(deriveNivel(80, thresholds)).toBe('alto');
    expect(deriveNivel(99, thresholds)).toBe('alto');
  });

  it('returns "critico" for NPR ≥ 100', () => {
    expect(deriveNivel(100, thresholds)).toBe('critico');
    expect(deriveNivel(125, thresholds)).toBe('critico');
  });

  it('derives correctly from computed NPR (3×3×3=27)', () => {
    const npr = computeNPR(3, 3, 3);
    expect(deriveNivel(npr, thresholds)).toBe('medio');
  });

  it('derives correctly from computed NPR (4×4×4=64)', () => {
    const npr = computeNPR(4, 4, 4);
    expect(deriveNivel(npr, thresholds)).toBe('alto');
  });
});
