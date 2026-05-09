/**
 * anomalyDetector.ts
 *
 * Multi-dimensional anomaly scoring engine for advanced auditoria.
 * Computes anomaly scores across 5 dimensions with weighted aggregation.
 *
 * Phase 7 Wave 2 — SA-09
 * RDC 978 Art. 107 — Anomaly detection in operation audit trail
 * DICQ 4.4 — Monitoring + anomaly patterns
 */

import type { BaselineStats } from './normalizeBaseline';

/**
 * Anomaly dimension types
 */
export type AnomalyDimension =
  | 'operation_rarity'
  | 'time_anomaly'
  | 'result_rarity'
  | 'velocity'
  | 'module_jump';

/**
 * Dimension score with evidence
 */
export interface DimensionScore {
  dimension: AnomalyDimension;
  score: number;  // 0-1
  evidence: string;
}

/**
 * Full anomaly detection result
 */
export interface AnomalyDetectionResult {
  entryId: string;
  overall: number;  // 0-1, weighted composite
  dimensions: DimensionScore[];
  flags: string[];  // Triggered dimension flags
}

/**
 * Audit entry type for scoring
 */
export interface AuditEntryForScoring {
  operatorId: string;
  operation: string;
  modulo: string;
  resultado?: string;  // 'sucesso' | 'falha' | 'aviso'
  timestamp: number;  // ms
}

/**
 * Dimension weights (sum = 1.0)
 */
const DIMENSION_WEIGHTS: Record<AnomalyDimension, number> = {
  operation_rarity: 0.25,
  time_anomaly: 0.20,
  result_rarity: 0.20,
  velocity: 0.20,
  module_jump: 0.15,
};

/**
 * Compute multi-dimensional anomaly scores from audit entry and baseline
 *
 * @param entry Audit entry to score
 * @param baseline Historical baseline model
 * @returns Anomaly detection result with per-dimension scores and flags
 */
export function scoreEntry(
  entry: AuditEntryForScoring,
  baseline: BaselineStats,
): Omit<AnomalyDetectionResult, 'entryId'> {
  const dimensions: DimensionScore[] = [];
  let overallScore = 0;

  // 1. Operation Rarity: how common is this operation for this operator?
  const opCount = baseline.operationCounts[entry.operation] || 0;
  const opFreq = baseline.totalEntries > 0 ? opCount / baseline.totalEntries : 0;
  const opRarityScore = opFreq === 0 ? 1.0 : Math.max(0, 1.0 - opFreq);
  dimensions.push({
    dimension: 'operation_rarity',
    score: opRarityScore,
    evidence: opFreq === 0
      ? `Operation "${entry.operation}" not in baseline`
      : `Operation frequency ${(opFreq * 100).toFixed(1)}%`,
  });

  // 2. Time Anomaly: is this time of day unusual?
  const hourlyScore = scoreTimeAnomaly(entry.timestamp, baseline);
  dimensions.push({
    dimension: 'time_anomaly',
    score: hourlyScore,
    evidence: buildTimeAnomalyEvidence(entry.timestamp, baseline),
  });

  // 3. Result Rarity: does result match historical pattern?
  const resultScore = scoreResultRarity(entry.resultado, baseline);
  dimensions.push({
    dimension: 'result_rarity',
    score: resultScore,
    evidence: buildResultRarityEvidence(entry.resultado),
  });

  // 4. Velocity: high-speed operation burst (v1: always 0, reserved for stateful tracking)
  dimensions.push({
    dimension: 'velocity',
    score: 0.0,
    evidence: 'Velocity detection reserved for v2 (requires time-window state)',
  });

  // 5. Module Jump: switching modules unusually fast (v1: always 0, reserved for state)
  dimensions.push({
    dimension: 'module_jump',
    score: 0.0,
    evidence: 'Module jump detection reserved for v2 (requires sequence state)',
  });

  // Compute weighted composite score
  for (const dim of dimensions) {
    const weight = DIMENSION_WEIGHTS[dim.dimension];
    overallScore += dim.score * weight;
  }

  // Clamp to [0, 1]
  overallScore = Math.max(0, Math.min(1.0, overallScore));

  // Determine flags (dimensions scoring > 0.6)
  const flags: string[] = [];
  for (const dim of dimensions) {
    if (dim.score > 0.6) {
      flags.push(dim.dimension);
    }
  }

  return { overall: overallScore, dimensions, flags };
}

/**
 * Score time anomaly: how unusual is this hour for the operator?
 *
 * @param timestamp Entry timestamp (ms)
 * @param baseline Historical baseline
 * @returns Anomaly score 0-1
 */
function scoreTimeAnomaly(timestamp: number, baseline: BaselineStats): number {
  const date = new Date(timestamp);
  const hour = date.getHours();

  if (baseline.hourlyPattern.length === 0) {
    return 0;
  }

  const expectedProb = baseline.hourlyPattern[hour] || 0;
  const mean = 1 / 24;  // Uniform expectation

  // Calculate variance across hourly distribution
  const variance = baseline.hourlyPattern.reduce(
    (sum, p) => sum + Math.pow(p - mean, 2),
    0,
  ) / baseline.hourlyPattern.length;

  const stddev = Math.sqrt(variance);

  if (stddev === 0) {
    return 0;  // No variation in pattern
  }

  // Z-score: how many standard deviations from mean?
  const zScore = Math.abs((expectedProb - mean) / stddev);

  // Clamp to [0, 1] — 3-sigma = 1.0
  return Math.min(1.0, zScore / 3);
}

/**
 * Build human-readable evidence for time anomaly
 */
function buildTimeAnomalyEvidence(timestamp: number, baseline: BaselineStats): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const prob = baseline.hourlyPattern[hour] || 0;
  const freq = (prob * 100).toFixed(1);

  return `Operation at ${hour}:00 (baseline frequency: ${freq}%)`;
}

/**
 * Score result rarity: how expected is this result?
 *
 * Heuristic: fail → 1.0, aviso → 0.6, sucesso → 0.0
 *
 * @param resultado Result type ('sucesso' | 'falha' | 'aviso')
 * @param baseline Baseline (reserved for future refinement)
 * @returns Anomaly score 0-1
 */
function scoreResultRarity(resultado: string | undefined, baseline: BaselineStats): number {
  if (!resultado) {
    return 0;  // No result, assume normal
  }

  const lower = resultado.toLowerCase();

  if (lower.includes('falha') || lower.includes('fail') || lower.includes('erro')) {
    return 1.0;  // Failures are anomalous
  }

  if (lower.includes('aviso') || lower.includes('warn')) {
    return 0.6;  // Warnings somewhat anomalous
  }

  return 0.0;  // Success is baseline
}

/**
 * Build human-readable evidence for result rarity
 */
function buildResultRarityEvidence(resultado: string | undefined): string {
  if (!resultado) {
    return 'No result recorded';
  }

  const lower = resultado.toLowerCase();

  if (lower.includes('falha') || lower.includes('fail') || lower.includes('erro')) {
    return 'Result: failure (high anomaly)';
  }

  if (lower.includes('aviso') || lower.includes('warn')) {
    return 'Result: warning (medium anomaly)';
  }

  return 'Result: success (baseline)';
}

/**
 * Detect anomalies in an audit entry
 * Pure function wrapper for testing
 *
 * @param entryId Entry ID for tracking
 * @param entry Audit entry data
 * @param baseline Baseline statistics
 * @returns Full anomaly detection result
 */
export function detectAnomalies(
  entryId: string,
  entry: AuditEntryForScoring,
  baseline: BaselineStats,
): AnomalyDetectionResult {
  const scored = scoreEntry(entry, baseline);

  return {
    entryId,
    overall: scored.overall,
    dimensions: scored.dimensions,
    flags: scored.flags,
  };
}
