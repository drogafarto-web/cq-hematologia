/**
 * Hook: Subscribe to analytics aggregates from Firestore
 *
 * Establishes real-time listeners for both the metrics cache and metadata doc.
 * Validates incoming data via Zod schema, then writes to the Zustand store.
 *
 * Multi-tenant: resets store whenever labId changes to prevent cross-lab leakage.
 * Cleanup: unsubscribes from all listeners on unmount or labId change.
 */

import { useEffect } from 'react';
import { onSnapshot } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAnalyticsStore } from './useAnalyticsCache';
import { ciqComplianceRef, analyticsMetaRef } from '../services/analyticsQueries';
import {
  parseAnalyticsAggregate,
  coerceAggregateTimestamps,
  analyticsMetadataSchema,
} from '../services/analyticsSchema';
import type { AnalyticsAggregate } from '../types/Analytics';
import type { AnalyticsMetadata } from '../types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribe to Firestore analytics cache and populate the Zustand store.
 *
 * Call once at the analytics feature root (AnalyticsHub).
 * All child dashboards read from the store — they do NOT call this hook directly.
 *
 * @returns void — side effects only (updates Zustand store)
 */
export function useAnalyticsAggregates(): void {
  const labId = useActiveLabId();

  useEffect(() => {
    // Always read actions from store at effect run time — avoids stale closures
    const { resetForLab, setAggregate, setMetadata, setLoading, setError } =
      useAnalyticsStore.getState();

    if (!labId) {
      setLoading(false);
      return;
    }

    // Reset store to prevent stale data from a previously active lab
    resetForLab(labId);

    // ── Metrics listener ────────────────────────────────────────────────────
    const unsubMetrics = onSnapshot(
      ciqComplianceRef(labId),
      (snap) => {
        if (!snap.exists()) {
          setAggregate(null);
          setLoading(false);
          return;
        }

        const raw = snap.data();
        const parsed = parseAnalyticsAggregate({ labId, ...raw });
        if (!parsed) {
          setError('Dados de analytics inválidos — cache corrompido.');
          setLoading(false);
          return;
        }

        const coerced = coerceAggregateTimestamps(parsed);
        setAggregate(coerced as unknown as AnalyticsAggregate);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[Analytics] Metrics listener error:', err);
        setError(err.message ?? 'Falha ao carregar analytics');
        setLoading(false);
      },
    );

    // ── Metadata listener ───────────────────────────────────────────────────
    const unsubMeta = onSnapshot(
      analyticsMetaRef(labId),
      (snap) => {
        if (!snap.exists()) return;
        const result = analyticsMetadataSchema.safeParse({ labId, ...snap.data() });
        if (!result.success) return;

        const raw = result.data;
        // Coerce lastRefreshAt Timestamp → Date
        const lastRefreshAt = (() => {
          const v = raw.lastRefreshAt;
          if (!v) return null;
          if (v instanceof Date) return v;
          if (typeof (v as any).toDate === 'function') return (v as any).toDate();
          return null;
        })();

        const metadata: AnalyticsMetadata = {
          labId: raw.labId,
          lastRefreshAt,
          refreshIntervalMinutes: raw.refreshIntervalMinutes,
          isCached: raw.isCached,
          cacheExpiresAt: raw.cacheExpiresAt ?? null,
          staleWarningMinutes: raw.staleWarningMinutes,
        };
        setMetadata(metadata);
      },
      (err) => {
        // Metadata failure is non-critical — log and continue
        console.warn('[Analytics] Metadata listener error:', err);
      },
    );

    return () => {
      unsubMetrics();
      unsubMeta();
    };
  }, [labId]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Convenience selector re-exports ─────────────────────────────────────────

export {
  useAnalyticsStore,
  useAnalyticsAggregate,
  useAnalyticsMetadata,
  useAnalyticsLoading,
  useAnalyticsRefreshing,
  useAnalyticsError,
} from './useAnalyticsCache';
