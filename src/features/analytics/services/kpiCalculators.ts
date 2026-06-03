/**
 * KPI Calculator Functions
 *
 * Pure functions for computing KPIs from raw aggregate data.
 * No side effects, no async, fully testable in isolation.
 */

import type { AnalyticsAggregate, KPISummary } from '../types/Analytics';

// ─── Compliance ───────────────────────────────────────────────────────────────

/**
 * Compute CIQ compliance percentage.
 *
 * Formula: (validRuns / totalRuns) * 100
 * Returns 0 when totalRuns is 0 to avoid division-by-zero.
 *
 * @param validRuns Number of runs that passed all Westgard rules
 * @param totalRuns Total number of runs in the period
 * @returns Compliance % rounded to 1 decimal place (0–100)
 */
export function calculateCompliance(validRuns: number, totalRuns: number): number {
  if (totalRuns <= 0) return 0;
  const raw = (validRuns / totalRuns) * 100;
  return Math.round(raw * 10) / 10;
}

// ─── Turnaround ───────────────────────────────────────────────────────────────

/**
 * Compute average processing turnaround in hours.
 *
 * Clamps result to 2 decimal places. Returns 0 if not computable.
 *
 * @param avgProcessingHours Raw average from Firestore aggregate
 * @returns Formatted turnaround in hours (2dp)
 */
export function calculateTurnaround(avgProcessingHours: number): number {
  if (!Number.isFinite(avgProcessingHours) || avgProcessingHours < 0) return 0;
  return Math.round(avgProcessingHours * 100) / 100;
}

// ─── Retrabalho ───────────────────────────────────────────────────────────────

/**
 * Compute rework percentage (retrabalho).
 *
 * Formula: (retrabalhoCount / totalRuns) * 100
 * Returns 0 when totalRuns is 0.
 *
 * @param retrabalhoCount Number of runs flagged for rework
 * @param totalRuns Total run count in the period
 * @returns Retrabalho % rounded to 1 decimal place (0–100)
 */
export function calculateRetrabalho(retrabalhoCount: number, totalRuns: number): number {
  if (totalRuns <= 0) return 0;
  const raw = (retrabalhoCount / totalRuns) * 100;
  return Math.round(raw * 10) / 10;
}

// ─── NC resolution rate ───────────────────────────────────────────────────────

/**
 * Compute NC resolution rate.
 *
 * Formula: (closedNCs / (openNCs + closedNCs)) * 100
 * Returns 100 when there are no NCs (all resolved by definition).
 *
 * @param openNCs Open (pending) non-conformities
 * @param closedNCs Closed (resolved) non-conformities
 * @returns Resolution rate % (0–100)
 */
export function calculateNCResolutionRate(openNCs: number, closedNCs: number): number {
  const total = openNCs + closedNCs;
  if (total <= 0) return 100;
  return Math.round((closedNCs / total) * 1000) / 10;
}

// ─── Composite KPI summary ────────────────────────────────────────────────────

/**
 * Derive a KPISummary from a full AnalyticsAggregate.
 *
 * Accepts optional prior-period aggregate for computing deltas.
 *
 * @param current Current period aggregate
 * @param prior Optional prior period aggregate for trend deltas
 * @returns KPISummary for ComplianceStatusDash
 */
export function deriveKPISummary(
  current: AnalyticsAggregate,
  prior?: AnalyticsAggregate | null,
): KPISummary {
  const compliancePercent = calculateCompliance(current.validRuns, current.totalRuns);
  const retrabalhoPercent = calculateRetrabalho(current.retrabalhoCount, current.totalRuns);

  const summary: KPISummary = {
    compliancePercent,
    openNCs: current.openNCs,
    avgResolutionDays: Math.round(current.avgResolutionDays * 10) / 10,
    retrabalhoPercent,
  };

  if (prior) {
    const priorCompliance = calculateCompliance(prior.validRuns, prior.totalRuns);
    summary.complianceDelta = Math.round((compliancePercent - priorCompliance) * 10) / 10;
    summary.ncDelta = current.openNCs - prior.openNCs;
  }

  return summary;
}

// ─── NC heatmap intensity normalizer ─────────────────────────────────────────

/**
 * Normalize NC counts across all heatmap cells to [0, 1] intensities.
 *
 * Used by NCHeatmapDash for color mapping.
 *
 * @param cells Array of { count } objects
 * @returns Array of intensities (same order)
 */
export function normalizeHeatmapIntensities(cells: Array<{ count: number }>): number[] {
  const max = Math.max(1, ...cells.map((c) => c.count));
  return cells.map((c) => c.count / max);
}

// ─── Staleness detection ──────────────────────────────────────────────────────

/**
 * Returns true if the aggregate is older than thresholdMinutes.
 *
 * @param computedAt Timestamp of last aggregation
 * @param thresholdMinutes Staleness threshold (default 30 min)
 */
export function isAggregateStale(computedAt: Date | null, thresholdMinutes = 30): boolean {
  if (!computedAt) return true;
  const ageMs = Date.now() - computedAt.getTime();
  return ageMs > thresholdMinutes * 60 * 1000;
}
