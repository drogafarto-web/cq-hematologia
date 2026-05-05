/**
 * Analytics Zustand Store
 *
 * Central cache for analytics aggregate data. Populated by useAnalyticsAggregates.
 * Consumed by dashboard components via atomic selectors.
 *
 * Performance target: dashboards read from Zustand store (sync, <1ms),
 * not directly from Firestore listeners (async, network latency).
 */

import { create } from 'zustand';
import type { AnalyticsAggregate } from '../types/Analytics';
import type { AnalyticsMetadata } from '../types';

// ─── Store shape ──────────────────────────────────────────────────────────────

interface AnalyticsStoreState {
  /** Most-recent validated aggregate for the active lab */
  aggregate: AnalyticsAggregate | null;
  /** Metadata (lastRefreshAt, staleness) */
  metadata: AnalyticsMetadata | null;
  /** True while first load is in flight (shows skeleton loaders) */
  loading: boolean;
  /** True while a manual refresh is in progress */
  refreshing: boolean;
  /** Error message from last failed fetch/subscribe */
  error: string | null;
  /** The labId this store is currently scoped to */
  labId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────────
  setAggregate: (aggregate: AnalyticsAggregate | null) => void;
  setMetadata: (metadata: AnalyticsMetadata | null) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  /** Reset store when lab changes — prevents cross-lab data leakage */
  resetForLab: (labId: string) => void;
  /** Full clear — on sign out */
  clear: () => void;
}

// ─── Store creation ───────────────────────────────────────────────────────────

export const useAnalyticsStore = create<AnalyticsStoreState>((set) => ({
  aggregate: null,
  metadata: null,
  loading: true,
  refreshing: false,
  error: null,
  labId: null,

  setAggregate: (aggregate) => set({ aggregate }),
  setMetadata: (metadata) => set({ metadata }),
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setError: (error) => set({ error, loading: false }),

  resetForLab: (labId) =>
    set({
      aggregate: null,
      metadata: null,
      loading: true,
      refreshing: false,
      error: null,
      labId,
    }),

  clear: () =>
    set({
      aggregate: null,
      metadata: null,
      loading: false,
      refreshing: false,
      error: null,
      labId: null,
    }),
}));

// ─── Atomic selectors (avoid new object references on every render) ───────────

export const useAnalyticsAggregate = () =>
  useAnalyticsStore((s) => s.aggregate);

export const useAnalyticsMetadata = () =>
  useAnalyticsStore((s) => s.metadata);

export const useAnalyticsLoading = () =>
  useAnalyticsStore((s) => s.loading);

export const useAnalyticsRefreshing = () =>
  useAnalyticsStore((s) => s.refreshing);

export const useAnalyticsError = () =>
  useAnalyticsStore((s) => s.error);
