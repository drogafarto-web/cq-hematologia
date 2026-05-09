/**
 * normalizeBaseline.ts
 *
 * Compute and normalize baseline model for operator behavior anomaly detection.
 * Input: historical audit entries. Output: baseline statistics + anomaly scoring.
 *
 * Phase 7 Wave 1 — SA-06
 * RDC 978 Art. 107 — Historical behavior baseline for anomaly detection
 * DICQ 4.4 — Monitoring patterns
 */

import type { QualidadeAuditEntry } from '../modules/qualidade/types';

/**
 * Baseline statistics for an operator in a lab
 * Captures: operation frequency, module preference, hourly patterns, diversity
 */
export interface BaselineStats {
  operationCounts: Record<string, number>;  // "create": 145, "update": 89, "delete": 12
  moduleFrequency: Record<string, number>;  // "capa": 0.62, "analise": 0.38
  hourlyPattern: number[];                  // [0.01, 0.02, ..., 0.15] sum=1, length 24
  totalEntries: number;
  entropyScore: number;                     // 0-1, measure of diversity
}

/**
 * Compute baseline statistics from a set of audit entries
 * Returns aggregated behavior profile for operator
 *
 * @param entries Historical audit entries (should span several days/weeks)
 * @returns Baseline statistics object
 */
export function computeBaseline(entries: QualidadeAuditEntry[]): BaselineStats {
  if (entries.length === 0) {
    return {
      operationCounts: {},
      moduleFrequency: {},
      hourlyPattern: Array(24).fill(1 / 24),  // Uniform distribution
      totalEntries: 0,
      entropyScore: 1.0,  // Max entropy for uniform distribution
    };
  }

  // 1. Count operations by type
  const operationCounts: Record<string, number> = {};
  for (const entry of entries) {
    const op = entry.operation || 'unknown';
    operationCounts[op] = (operationCounts[op] || 0) + 1;
  }

  // 2. Calculate module frequency (normalized to sum=1)
  const moduleCounts: Record<string, number> = {};
  for (const entry of entries) {
    const mod = entry.modulo || 'unknown';
    moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
  }

  const moduleFrequency: Record<string, number> = {};
  for (const [mod, count] of Object.entries(moduleCounts)) {
    moduleFrequency[mod] = count / entries.length;
  }

  // 3. Build hourly distribution (0-23 hours)
  const hourlyBuckets = Array(24).fill(0);
  for (const entry of entries) {
    if (entry.timestamp && 'toDate' in entry.timestamp) {
      const date = (entry.timestamp as any).toDate();
      const hour = date.getHours();
      hourlyBuckets[hour]++;
    }
  }

  // Normalize to sum=1
  const hourlyPattern = hourlyBuckets.map((count) => count / entries.length);

  // 4. Compute Shannon entropy as diversity measure
  const entropyScore = computeEntropy(hourlyPattern);

  return {
    operationCounts,
    moduleFrequency,
    hourlyPattern,
    totalEntries: entries.length,
    entropyScore,
  };
}

/**
 * Normalize a new entry against baseline
 * Returns anomaly score 0-1 (1 = maximum deviation from baseline)
 *
 * Considers:
 * - How rare is this operation type for this operator?
 * - How far is this hour from the typical pattern?
 * - Composite z-score across dimensions
 *
 * @param baseline Historical baseline model
 * @param newEntry New audit entry to score
 * @returns Anomaly score 0-1
 */
export function normalizeBaseline(baseline: BaselineStats, newEntry: QualidadeAuditEntry): number {
  if (baseline.totalEntries === 0) {
    return 0;  // No baseline yet, assume normal
  }

  let anomalyScore = 0;
  let dimensionCount = 0;

  // 1. Score operation rarity
  const opCount = baseline.operationCounts[newEntry.operation] || 0;
  const opFreq = opCount / baseline.totalEntries;
  const opRarity = opFreq === 0 ? 1.0 : Math.min(1.0, 1.0 - opFreq);  // Rare operations score high
  anomalyScore += opRarity;
  dimensionCount++;

  // 2. Score time anomaly (how unusual is this hour?)
  let hourlyAnomaly = 0;
  if (newEntry.timestamp && 'toDate' in newEntry.timestamp) {
    const date = (newEntry.timestamp as any).toDate();
    const hour = date.getHours();
    const expectedProb = baseline.hourlyPattern[hour];
    const maxProb = Math.max(...baseline.hourlyPattern);
    const minProb = Math.min(...baseline.hourlyPattern);

    // Normalize deviation
    if (maxProb === minProb) {
      hourlyAnomaly = 0;  // Uniform pattern, no anomaly
    } else {
      // z-score: how many standard deviations from the mean?
      const mean = 1 / 24;
      const variance = baseline.hourlyPattern.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / 24;
      const stddev = Math.sqrt(variance);
      if (stddev > 0) {
        const zScore = Math.abs((expectedProb - mean) / stddev);
        hourlyAnomaly = Math.min(1.0, zScore / 3);  // Cap at 1.0 (3 sigma)
      }
    }
    anomalyScore += hourlyAnomaly;
    dimensionCount++;
  }

  // 3. Score module preference deviation
  const moduleFreq = baseline.moduleFrequency[newEntry.modulo] || 0;
  const moduleAnomaly = moduleFreq === 0 ? 1.0 : Math.min(1.0, 1.0 - moduleFreq);
  anomalyScore += moduleAnomaly;
  dimensionCount++;

  // Return normalized score (average of dimensions)
  return dimensionCount > 0 ? anomalyScore / dimensionCount : 0;
}

/**
 * Compute Shannon entropy of a probability distribution
 * Range: 0 (no diversity) to log2(n) (perfect diversity)
 * Normalized to 0-1 for n=24 (hours)
 *
 * @param probabilities Array of probabilities (sum should be ~1)
 * @returns Entropy score 0-1
 */
function computeEntropy(probabilities: number[]): number {
  let entropy = 0;
  const maxEntropy = Math.log2(probabilities.length);  // log2(24) ≈ 4.58

  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize to 0-1
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}
