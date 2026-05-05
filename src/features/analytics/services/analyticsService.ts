/**
 * Client-side service for analytics operations
 *
 * Phase 3.1: Placeholder for reads only (via hook).
 * Phase 3.2: Manual refresh callable, export operations.
 * Phase 3.3: refreshAggregates for polling-triggered re-fetch.
 */

import { getDoc, doc } from '../../../shared/services/firebase';
import { db } from '../../../shared/services/firebase';
import { useAnalyticsStore } from '../hooks/useAnalyticsCache';
import { ciqComplianceRef } from './analyticsQueries';
import { parseAnalyticsAggregate, coerceAggregateTimestamps } from './analyticsSchema';
import type { AnalyticsAggregate } from '../types/Analytics';
import type { AggregationResult } from '../types';

/**
 * Analytics service layer
 *
 * Placeholder structure for Phase 3.1.
 * Enables IDE autocomplete and provides extension point for Phase 3.2.
 */
export const AnalyticsService = {
  /**
   * Manual refresh: call Cloud Function to immediately aggregate metrics
   *
   * Not yet implemented; scheduled function runs hourly.
   *
   * Phase 3.2: Will implement as Cloud Callable
   * `httpsCallable<{labId: string}, AggregationResult>('analytics_refreshNow')`
   *
   * @param labId Lab to refresh
   * @returns Aggregation result
   * @throws Error if not implemented
   */
  refreshNow: async (labId: string): Promise<AggregationResult> => {
    console.warn('[Analytics] Manual refresh not yet implemented (Phase 3.2)');
    return {
      labId,
      metrics: {} as any,
      error: 'Not implemented in Phase 3.1',
    };
  },

  /**
   * Re-fetch the latest CIQ compliance aggregate from Firestore.
   * Called by useRealtimePolling when meta lastRefreshAt changes.
   *
   * @param labId Active lab ID
   */
  refreshAggregates: async (labId: string): Promise<void> => {
    const { setAggregate, setLoading, setError } = useAnalyticsStore.getState();
    setLoading(true);
    try {
      const snap = await getDoc(ciqComplianceRef(labId));
      if (!snap.exists()) {
        setAggregate(null);
        return;
      }
      const raw = snap.data();
      const parsed = parseAnalyticsAggregate({ labId, ...raw });
      if (!parsed) {
        setError('Dados de analytics inválidos — cache corrompido.');
        return;
      }
      const coerced = coerceAggregateTimestamps(parsed);
      setAggregate(coerced as unknown as AnalyticsAggregate);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  },

  /**
   * Export analytics for a date range
   *
   * Phase 3.2: Will integrate with project-wide export system.
   * Supports XLSX and PDF formats.
   *
   * @param labId Lab to export
   * @param format Output format (xlsx | pdf)
   * @returns Job ID for tracking
   * @throws Error if not implemented
   */
  exportAnalytics: async (
    labId: string,
    format: 'xlsx' | 'pdf' = 'xlsx',
  ): Promise<{ jobId: string }> => {
    console.warn('[Analytics] Export not yet implemented (Phase 3.2)');
    throw new Error('Not implemented in Phase 3.1');
  },
};
