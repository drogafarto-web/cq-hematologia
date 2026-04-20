import { describe, it, expect } from 'vitest';
import { calculateZScore, interpretZScore, calculateRunStats } from '../../../src/utils/zscore';
import type { AnalyteStats, CQRun } from '../../../src/types';

// Mock Timestamp (Firestore Timestamp shape)
const mockTimestamp = {
  seconds: 1710000000,
  nanoseconds: 0,
  toDate: () => new Date(1710000000 * 1000),
  toMillis: () => 1710000000 * 1000,
  isEqual: () => false,
  toJSON: () => ({ seconds: 1710000000, nanoseconds: 0 }),
  valueOf: () => 1710000000 * 1000,
} as any;

describe('zscore utilities', () => {
  describe('calculateZScore', () => {
    it('calcula z‑score corretamente', () => {
      const stats: AnalyteStats = { mean: 100, sd: 10 };
      expect(calculateZScore(110, stats)).toBe(1);
      expect(calculateZScore(90, stats)).toBe(-1);
      expect(calculateZScore(100, stats)).toBe(0);
    });

    it('retorna NaN quando sd === 0', () => {
      const stats: AnalyteStats = { mean: 50, sd: 0 };
      expect(calculateZScore(60, stats)).toBeNaN();
    });
  });

  describe('interpretZScore', () => {
    it('classifica como acceptable abaixo de ±2 (exclusivo)', () => {
      expect(interpretZScore(0)).toBe('acceptable');
      expect(interpretZScore(1.5)).toBe('acceptable');
      expect(interpretZScore(-1.9)).toBe('acceptable');
    });

    it('classifica como warning em ±2 e entre ±2 e ±3 (Westgard 1-2s)', () => {
      expect(interpretZScore(2)).toBe('warning'); // boundary inclusivo
      expect(interpretZScore(-2)).toBe('warning');
      expect(interpretZScore(2.1)).toBe('warning');
      expect(interpretZScore(-2.5)).toBe('warning');
      expect(interpretZScore(2.9)).toBe('warning');
    });

    it('classifica como rejection em ±3 e além (Westgard 1-3s)', () => {
      expect(interpretZScore(3)).toBe('rejection'); // boundary inclusivo
      expect(interpretZScore(-3)).toBe('rejection');
      expect(interpretZScore(3.1)).toBe('rejection');
      expect(interpretZScore(-4)).toBe('rejection');
    });

    it('trata NaN como warning (lote novo)', () => {
      expect(interpretZScore(NaN)).toBe('warning');
    });
  });

  describe('calculateRunStats', () => {
    const mockRuns: CQRun[] = [
      {
        id: '1',
        operatorId: 'user1',
        operatorName: 'Operador 1',
        operatorRole: 'biomedico',
        confirmedAt: mockTimestamp,
        aiData: { WBC: 7.5, RBC: 4.8 },
        aiConfidence: { WBC: 0.95, RBC: 0.92 },
        isEdited: false,
        confirmedData: { WBC: 7.5, RBC: 4.8 },
        labId: 'lab1',
        lotId: 'lot1',
        level: 1,
        status: 'Aprovada',
        version: 1,
        createdAt: mockTimestamp,
        createdBy: 'user1',
      },
      {
        id: '2',
        operatorId: 'user1',
        operatorName: 'Operador 1',
        operatorRole: 'biomedico',
        confirmedAt: mockTimestamp,
        aiData: { WBC: 8.0, RBC: 4.9 },
        aiConfidence: { WBC: 0.94, RBC: 0.91 },
        isEdited: false,
        confirmedData: { WBC: 8.0, RBC: 4.9 },
        labId: 'lab1',
        lotId: 'lot1',
        level: 1,
        status: 'Aprovada',
        version: 1,
        createdAt: mockTimestamp,
        createdBy: 'user1',
      },
      {
        id: '3',
        operatorId: 'user1',
        operatorName: 'Operador 1',
        operatorRole: 'biomedico',
        confirmedAt: mockTimestamp,
        aiData: { WBC: 7.8, RBC: 4.7 },
        aiConfidence: { WBC: 0.93, RBC: 0.9 },
        isEdited: false,
        confirmedData: { WBC: 7.8, RBC: 4.7 },
        labId: 'lab1',
        lotId: 'lot1',
        level: 1,
        status: 'Aprovada',
        version: 1,
        createdAt: mockTimestamp,
        createdBy: 'user1',
      },
    ];

    it('calcula média, desvio padrão, CV e n para analito existente', () => {
      const stats = calculateRunStats(mockRuns, 'WBC');
      // média = (7.5 + 8.0 + 7.8) / 3 = 7.766666...
      expect(stats.mean).toBeCloseTo(7.766666, 5);
      // desvio padrão amostral ≈ 0.251661
      expect(stats.sd).toBeCloseTo(0.251661, 5);
      // CV = (sd / mean) * 100 ≈ 3.239
      expect(stats.cv).toBeCloseTo(3.239, 2);
      expect(stats.n).toBe(3);
    });

    it('retorna zeros quando não há valores numéricos', () => {
      const stats = calculateRunStats(mockRuns, 'PLT'); // analito não presente
      expect(stats.mean).toBe(0);
      expect(stats.sd).toBe(0);
      expect(stats.cv).toBe(0);
      expect(stats.n).toBe(0);
    });

    it('retorna sd = 0 quando apenas um valor', () => {
      const singleRun = [mockRuns[0]];
      const stats = calculateRunStats(singleRun, 'WBC');
      expect(stats.mean).toBe(7.5);
      expect(stats.sd).toBe(0);
      expect(stats.cv).toBe(0);
      expect(stats.n).toBe(1);
    });
  });
});
