// ─── CQI Stats Calculator ─────────────────────────────────────────────────────
// Pure functions — no external dependencies.
// SD uses Bessel-corrected sample formula (n-1), matching ISO 5725 / CLSI EP05
// and the same convention used in the frontend's useRuns.ts.

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function calculateSD(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Returns CV as a percentage rounded to 2 decimal places. Returns 0 when mean is 0. */
export function calculateCV(sd: number, mean: number): number {
  if (mean === 0) return 0;
  return parseFloat(((sd / Math.abs(mean)) * 100).toFixed(2));
}
