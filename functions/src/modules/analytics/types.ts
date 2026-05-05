/**
 * Analytics Domain Types (server-side)
 *
 * Duplicated from src/features/analytics/types/index.ts for function isolation.
 * Keeps function module self-contained (no dep on web build).
 */

export interface CIQComplianceMetrics {
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  openNCs: number;
  closedNCs: number;
  compliancePercent: number;
  ncResolutionRate: number;
  avgResolutionDays: number;
  avgProcessingHours: number;
  computedAt: Date | null;
  dataAsOf: Date | null;
}

export interface AnalyticsMetadata {
  labId: string;
  lastRefreshAt: Date | null;
  refreshIntervalMinutes: number;
  isCached: boolean;
  cacheExpiresAt?: Date | null;
  staleWarningMinutes?: number;
}

export interface AggregationResult {
  labId: string;
  metrics: CIQComplianceMetrics;
  error?: string;
  durationMs?: number;
}
