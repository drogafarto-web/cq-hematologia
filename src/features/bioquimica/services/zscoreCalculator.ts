/**
 * bioquimica/services/zscoreCalculator.ts
 *
 * Interlaboratorial z-score calculation aligned with CEQ comparison rounds.
 * Pure functions, no I/O.
 *
 * Compliance: DICQ 4.3 Bloco F 5.6.4 (interlaboratorial comparison),
 * RDC 978 Art. 179.
 */

import type { AnalitoId } from '../types/_shared_refs';

// ─── Input/Output Types ────────────────────────────────────────────────────

export interface InterlabPeerStats {
  analitoId: AnalitoId;
  peerCount: number;
  peerMean: number;
  peerSD: number;       // group SD across peer labs
  cycleId: string;      // e.g. "2026-Q2"
  source: 'ceq-provider' | 'internal-aggregate';
}

export interface InterlabZScoreInput {
  labResultValue: number;
  peerStats: InterlabPeerStats;
}

export interface InterlabZScoreOutput {
  zScore: number;
  classification: 'satisfactory' | 'questionable' | 'unsatisfactory';
  // CLSI EP15: |z| ≤ 2 satisfactory, 2 < |z| ≤ 3 questionable, |z| > 3 unsatisfactory
}

// ─── Z-Score Calculation ──────────────────────────────────────────────────

/**
 * Calculate interlaboratorial z-score for a result against peer statistics.
 * Follows CLSI EP15 classification.
 *
 * Throws Error if peerSD <= 0 (insufficient dispersion).
 */
export function calculateInterlabZScore(input: InterlabZScoreInput): InterlabZScoreOutput {
  const { labResultValue, peerStats } = input;

  if (peerStats.peerSD <= 0) {
    throw new Error('peerSD must be > 0');
  }

  const zScore = (labResultValue - peerStats.peerMean) / peerStats.peerSD;
  const absZ = Math.abs(zScore);

  let classification: 'satisfactory' | 'questionable' | 'unsatisfactory';
  if (absZ <= 2) {
    classification = 'satisfactory';
  } else if (absZ <= 3) {
    classification = 'questionable';
  } else {
    classification = 'unsatisfactory';
  }

  return {
    zScore,
    classification,
  };
}

// ─── Peer Statistics Aggregation ──────────────────────────────────────────

/**
 * Aggregate peer lab results into mean and standard deviation.
 * Requires minimum 5 peer observations (per ISO 13528).
 *
 * Throws Error if insufficient peers.
 */
export function aggregatePeerStats(
  values: number[],
  cycleId: string,
  analitoId: AnalitoId
): InterlabPeerStats {
  if (values.length < 5) {
    throw new Error(`insufficient peer count: minimum 5, got ${values.length}`);
  }

  // Calculate mean
  const sum = values.reduce((acc, v) => acc + v, 0);
  const peerMean = sum / values.length;

  // Calculate sample standard deviation (n-1)
  const sumSquaredDiff = values.reduce((acc, v) => acc + Math.pow(v - peerMean, 2), 0);
  const peerSD = Math.sqrt(sumSquaredDiff / (values.length - 1));

  return {
    analitoId,
    peerCount: values.length,
    peerMean,
    peerSD,
    cycleId,
    source: 'internal-aggregate',
  };
}
