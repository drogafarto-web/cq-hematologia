/**
 * Hook: Analytics metadata (freshness, staleness indicator, last refresh)
 *
 * Derives presentational metadata state from the analytics Zustand store.
 * Returns formatted strings ready for display — no raw Dates exposed to UI.
 */

import { useMemo } from 'react';
import { useAnalyticsStore } from './useAnalyticsCache';
import { isAggregateStale } from '../services/kpiCalculators';

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface AnalyticsMetaState {
  /** True when analytics data is cached and recent enough */
  isCached: boolean;
  /** True when data is older than stale threshold (30 min by default) */
  isStale: boolean;
  /** Human-readable age string, e.g. "Atualizado há 15 min" */
  ageLabel: string;
  /** Raw lastRefreshAt Date or null */
  lastRefreshAt: Date | null;
  /** Refresh interval in minutes */
  refreshIntervalMinutes: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns metadata about analytics cache freshness.
 *
 * @returns AnalyticsMetaState for UI staleness indicators and refresh prompts
 */
export function useAnalyticsMeta(): AnalyticsMetaState {
  const aggregate = useAnalyticsStore((s) => s.aggregate);
  const metadata = useAnalyticsStore((s) => s.metadata);

  return useMemo((): AnalyticsMetaState => {
    const computedAt = aggregate?.computedAt ?? null;
    const lastRefreshAt = metadata?.lastRefreshAt ?? computedAt;
    const isStale = isAggregateStale(lastRefreshAt);
    const isCached = !isStale && lastRefreshAt !== null;
    const refreshIntervalMinutes = metadata?.refreshIntervalMinutes ?? 60;

    // Human-readable age label
    let ageLabel = 'Sem dados';
    if (lastRefreshAt) {
      const ageMs = Date.now() - lastRefreshAt.getTime();
      const ageMin = Math.floor(ageMs / 60000);
      if (ageMin < 1) {
        ageLabel = 'Atualizado agora';
      } else if (ageMin < 60) {
        ageLabel = `Atualizado há ${ageMin} min`;
      } else {
        const ageHr = Math.floor(ageMin / 60);
        ageLabel = `Atualizado há ${ageHr}h`;
      }
    }

    return { isCached, isStale, ageLabel, lastRefreshAt, refreshIntervalMinutes };
  }, [aggregate, metadata]);
}
