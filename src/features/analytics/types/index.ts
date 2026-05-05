/**
 * Analytics Domain Types
 *
 * Types for CIQ compliance metrics aggregation (hourly Cloud Function),
 * client-side React hooks, and Firestore cache structure.
 *
 * Multi-tenant: all metrics scoped to `/labs/{labId}/analytics/` paths.
 */

/**
 * CIQ Compliance metrics aggregated hourly
 *
 * Computed by scheduled Cloud Function for compliance dashboards.
 * Supports RDC 978 auditability: metrics are versionable, timestamped,
 * and reproducible from archived Firestore snapshots.
 */
export interface CIQComplianceMetrics {
  // Counts
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  openNCs: number;
  closedNCs: number;

  // Derived percentages
  compliancePercent: number;    // (validRuns / totalRuns) * 100
  ncResolutionRate: number;     // (closedNCs / (openNCs + closedNCs)) * 100

  // Timing
  avgResolutionDays: number;    // average days from NC creation to closure
  avgProcessingHours: number;   // average time from run creation to signing

  // Metadata
  computedAt: Date | null;      // timestamp of last aggregation
  dataAsOf: Date | null;        // as-of timestamp for snapshot
}

/**
 * Analytics metadata: freshness, last refresh time
 *
 * Tracks cache age for UI indicators ("Updated 15 min ago").
 * Used to decide staleness warnings and trigger manual refresh.
 */
export interface AnalyticsMetadata {
  labId: string;
  lastRefreshAt: Date | null;
  refreshIntervalMinutes: number; // typically 60
  isCached: boolean;
  cacheExpiresAt?: Date | null;
  staleWarningMinutes?: number;   // warn if data >30min old
}

/**
 * Analytics query filters
 *
 * Phase 3.1: All metrics are per-lab global.
 * Phase 3.2+: Support equipment, operator, and date range filters.
 */
export interface AnalyticsQueryFilter {
  labId: string;
  startDate?: Date;
  endDate?: Date;
  equipmentId?: string;          // Phase 3.2
  operatorId?: string;           // Phase 3.2
}

/**
 * Return type from Cloud Function aggregation
 *
 * Single lab result from `aggregateAnalytics()` cloud function.
 * When used in batch response, combine multiple results.
 */
export interface AggregationResult {
  labId: string;
  metrics: CIQComplianceMetrics;
  error?: string;
  durationMs?: number;
}

/**
 * React hook state for analytics
 *
 * Complete state shape returned by `useCIQAnalytics()`.
 * Allows components to render loading, error, and success states.
 */
export type AnalyticsState = {
  ciqCompliance: CIQComplianceMetrics | null;
  metadata: AnalyticsMetadata | null;
  loading: boolean;
  error: string | null;
};
