import { describe, it, expect } from 'vitest';
import {
  calcMeanSdBessel,
  calcZScore,
  calcCV,
  mergeStats,
} from '../utils/statsHelpers';

describe('statsHelpers', () => {
  describe('calcMeanSdBessel', () => {
    it('should calculate mean and SD correctly with Bessel correction', () => {
      const values = [100, 102, 98, 101, 99];
      const result = calcMeanSdBessel(values);

      expect(result.n).toBe(5);
      expect(result.mean).toBeCloseTo(100, 5);
      // SD with Bessel (n-1=4): sqrt(sum((x-mean)²) / 4)
      expect(result.sd).toBeGreaterThan(0);
      expect(Number.isFinite(result.sd)).toBe(true);
    });

    it('should handle empty array', () => {
      const result = calcMeanSdBessel([]);
      expect(result.n).toBe(0);
      expect(Number.isNaN(result.mean)).toBe(true);
      expect(Number.isNaN(result.sd)).toBe(true);
    });

    it('should handle single value', () => {
      const result = calcMeanSdBessel([100]);
      expect(result.n).toBe(1);
      expect(result.mean).toBe(100);
      expect(Number.isNaN(result.sd)).toBe(true); // Can't calculate SD with n=1
    });

    it('should filter out NaN and non-finite values', () => {
      const values = [100, 102, NaN, Infinity, 98, 101];
      const result = calcMeanSdBessel(values);

      expect(result.n).toBe(4);
      expect(result.mean).toBeCloseTo(100.25, 5);
    });

    it('should match Excel STDEV for known dataset', () => {
      // Excel STDEV for [10, 20, 30, 40, 50] = 15.811...
      const values = [10, 20, 30, 40, 50];
      const result = calcMeanSdBessel(values);

      expect(result.mean).toBe(30);
      expect(result.sd).toBeCloseTo(15.811388, 5);
    });
  });

  describe('calcZScore', () => {
    it('should calculate z-score correctly', () => {
      const value = 102;
      const stats = { mean: 100, sd: 1 };
      const zScore = calcZScore(value, stats);

      expect(zScore).toBe(2);
    });

    it('should handle negative z-scores', () => {
      const value = 98;
      const stats = { mean: 100, sd: 1 };
      const zScore = calcZScore(value, stats);

      expect(zScore).toBe(-2);
    });

    it('should return NaN for invalid stats', () => {
      expect(Number.isNaN(calcZScore(100, { mean: NaN, sd: 1 }))).toBe(true);
      expect(Number.isNaN(calcZScore(100, { mean: 100, sd: 0 }))).toBe(true);
      expect(Number.isNaN(calcZScore(100, { mean: 100, sd: -1 }))).toBe(true);
    });

    it('should return NaN for non-finite values', () => {
      expect(Number.isNaN(calcZScore(NaN, { mean: 100, sd: 1 }))).toBe(true);
      expect(Number.isNaN(calcZScore(Infinity, { mean: 100, sd: 1 }))).toBe(true);
    });
  });

  describe('calcCV', () => {
    it('should calculate coefficient of variation correctly', () => {
      const stats = { mean: 100, sd: 10 };
      const cv = calcCV(stats);

      expect(cv).toBeCloseTo(10, 5);
    });

    it('should return NaN for zero mean', () => {
      const stats = { mean: 0, sd: 10 };
      const cv = calcCV(stats);

      expect(Number.isNaN(cv)).toBe(true);
    });

    it('should handle negative mean (absolute value)', () => {
      const stats = { mean: -100, sd: 10 };
      const cv = calcCV(stats);

      expect(cv).toBeCloseTo(10, 5);
    });

    it('should return NaN for non-finite stats', () => {
      expect(Number.isNaN(calcCV({ mean: NaN, sd: 10 }))).toBe(true);
      expect(Number.isNaN(calcCV({ mean: 100, sd: Infinity }))).toBe(true);
    });
  });

  describe('mergeStats', () => {
    it('should merge two groups correctly', () => {
      const group1 = { mean: 100, sd: 5, n: 10 };
      const group2 = { mean: 105, sd: 3, n: 10 };

      const merged = mergeStats(group1, group2);

      expect(merged.n).toBe(20);
      expect(merged.mean).toBeCloseTo(102.5, 5);
      expect(Number.isFinite(merged.sd)).toBe(true);
    });

    it('should handle empty first group', () => {
      const group1 = { mean: NaN, sd: NaN, n: 0 };
      const group2 = { mean: 100, sd: 5, n: 10 };

      const merged = mergeStats(group1, group2);

      expect(merged.n).toBe(10);
      expect(merged.mean).toBe(100);
      expect(merged.sd).toBe(5);
    });

    it('should handle empty second group', () => {
      const group1 = { mean: 100, sd: 5, n: 10 };
      const group2 = { mean: NaN, sd: NaN, n: 0 };

      const merged = mergeStats(group1, group2);

      expect(merged.n).toBe(10);
      expect(merged.mean).toBe(100);
      expect(merged.sd).toBe(5);
    });

    it('should handle identical groups', () => {
      const group1 = { mean: 100, sd: 5, n: 10 };
      const group2 = { mean: 100, sd: 5, n: 10 };

      const merged = mergeStats(group1, group2);

      expect(merged.n).toBe(20);
      expect(merged.mean).toBe(100);
      expect(merged.sd).toBeCloseTo(5, 5);
    });

    it('should handle groups with different variances', () => {
      const group1 = { mean: 100, sd: 20, n: 5 };
      const group2 = { mean: 100, sd: 5, n: 15 };

      const merged = mergeStats(group1, group2);

      expect(merged.n).toBe(20);
      expect(merged.mean).toBe(100);
      // Merged SD should be between the two (closer to larger group's SD)
      expect(merged.sd).toBeGreaterThan(5);
      expect(merged.sd).toBeLessThan(20);
    });
  });
});
