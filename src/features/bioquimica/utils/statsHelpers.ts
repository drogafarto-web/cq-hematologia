/**
 * Statistical helpers for bioquímica CIQ
 * Uses Bessel correction (n-1) for unbiased SD estimation
 */

export interface StatsResult {
  mean: number;
  sd: number;
  n: number;
}

/**
 * Calculate mean and standard deviation using Bessel correction (n-1)
 * Matches Excel STDEV and statistical standards
 */
export function calcMeanSdBessel(values: number[]): StatsResult {
  if (!Array.isArray(values) || values.length === 0) {
    return { mean: NaN, sd: NaN, n: 0 };
  }

  // Filter out non-numeric values
  const validValues = values.filter((v) => Number.isFinite(v));
  if (validValues.length === 0) {
    return { mean: NaN, sd: NaN, n: 0 };
  }

  const n = validValues.length;
  const mean = validValues.reduce((sum, v) => sum + v, 0) / n;

  if (n === 1) {
    // Can't calculate SD with single value (would be 0 with Bessel)
    return { mean, sd: NaN, n: 1 };
  }

  const sumSquaredDiff = validValues.reduce((sum, v) => {
    const diff = v - mean;
    return sum + diff * diff;
  }, 0);

  const variance = sumSquaredDiff / (n - 1); // Bessel correction
  const sd = Math.sqrt(variance);

  return { mean, sd, n };
}

/**
 * Calculate Z-score for a single value
 */
export function calcZScore(value: number, stats: { mean: number; sd: number }): number {
  if (!Number.isFinite(value) || !Number.isFinite(stats.mean) || stats.sd <= 0) {
    return NaN;
  }
  return (value - stats.mean) / stats.sd;
}

/**
 * Calculate coefficient of variation (CV) in percentage
 * CV = (SD / mean) * 100
 * Useful for comparing variability across analytes with different ranges
 */
export function calcCV(stats: { mean: number; sd: number }): number {
  if (!Number.isFinite(stats.mean) || stats.mean === 0 || !Number.isFinite(stats.sd)) {
    return NaN;
  }
  return (Math.abs(stats.sd) / Math.abs(stats.mean)) * 100;
}

/**
 * Merge statistics from two independent groups using Welford's approach
 * Used when combining stats from different time periods or sources
 */
export function mergeStats(
  group1: StatsResult,
  group2: StatsResult
): StatsResult {
  if (group1.n === 0) return group2;
  if (group2.n === 0) return group1;

  const n = group1.n + group2.n;

  if (!Number.isFinite(group1.mean) || !Number.isFinite(group2.mean)) {
    return { mean: NaN, sd: NaN, n };
  }

  // Combined mean
  const mean = (group1.mean * group1.n + group2.mean * group2.n) / n;

  // Combined variance using Welford's method
  const var1 = group1.sd * group1.sd;
  const var2 = group2.sd * group2.sd;
  const delta = group2.mean - group1.mean;

  const combinedVar =
    ((group1.n - 1) * var1 + (group2.n - 1) * var2) / (n - 1) +
    (group1.n * group2.n * delta * delta) / (n * (n - 1));

  const sd = Math.sqrt(Math.max(0, combinedVar)); // Guard against numerical errors

  return { mean, sd, n };
}
