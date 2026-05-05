/**
 * React Hook: Subscribe to cached CIQ compliance analytics
 *
 * Subscribes to real-time metrics and metadata cached by the hourly
 * scheduled Cloud Function. Works across web and React Native (via
 * shared Firebase configuration).
 *
 * Behavior:
 * - Subscribes to `/labs/{labId}/analytics/cache/metrics/ciqCompliance`
 * - Also reads metadata from `/labs/{labId}/analytics/meta`
 * - Returns null if labId not set or user not authenticated
 * - Handles Firestore errors gracefully (returns error state, doesn't throw)
 * - Works offline: Firebase SDK caches reads, hook returns stale data if no network
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { CIQComplianceMetrics, AnalyticsMetadata, AnalyticsState } from '../types';

/**
 * Subscribe to cached CIQ compliance metrics for the active lab
 *
 * Returns { ciqCompliance, metadata, loading, error }
 *
 * @returns AnalyticsState with metrics, metadata, loading, and error states
 */
export function useCIQAnalytics(): AnalyticsState {
  const activeLabId = useActiveLabId();
  const [metrics, setMetrics] = useState<CIQComplianceMetrics | null>(null);
  const [metadata, setMetadata] = useState<AnalyticsMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeLabId) {
      setLoading(false);
      setMetrics(null);
      setMetadata(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to metrics cache
    const metricsRef = doc(
      db,
      'labs',
      activeLabId,
      'analytics',
      'cache',
      'metrics',
      'ciqCompliance',
    );

    const unsubscribeMetrics = onSnapshot(
      metricsRef,
      (snap: DocumentSnapshot) => {
        if (snap.exists()) {
          const data = snap.data() as CIQComplianceMetrics;
          // Convert Firestore Timestamp to Date
          if (data.computedAt && typeof data.computedAt !== 'number') {
            data.computedAt = new Date(data.computedAt as any);
          }
          setMetrics(data);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[Analytics] Error subscribing to metrics:', err);
        setError(err.message || 'Failed to load analytics');
        setLoading(false);
      },
    );

    // Subscribe to metadata
    const metaRef = doc(db, 'labs', activeLabId, 'analytics', 'meta');

    const unsubscribeMeta = onSnapshot(
      metaRef,
      (snap: DocumentSnapshot) => {
        if (snap.exists()) {
          const data = snap.data() as AnalyticsMetadata;
          // Convert Firestore Timestamp to Date
          if (data.lastRefreshAt && typeof data.lastRefreshAt !== 'number') {
            data.lastRefreshAt = new Date(data.lastRefreshAt as any);
          }
          setMetadata(data);
        }
      },
      (err) => {
        console.error('[Analytics] Error subscribing to metadata:', err);
        // Don't fail the entire hook if metadata fails; metrics are more important
      },
    );

    // Cleanup on unmount
    return () => {
      unsubscribeMetrics();
      unsubscribeMeta();
    };
  }, [activeLabId]);

  return {
    ciqCompliance: metrics,
    metadata,
    loading,
    error,
  };
}

/**
 * Helper: Format metrics for display
 *
 * Example: compliancePercent from 87.5 to "87.5% conformidade"
 *
 * @param metrics CIQ compliance metrics
 * @returns Object with formatted label strings
 */
export function formatAnalyticsMetrics(metrics: CIQComplianceMetrics) {
  return {
    complianceLabel: `${metrics.compliancePercent}% conformidade`,
    resolutionLabel: `${metrics.ncResolutionRate}% resolvido`,
    avgResolutionLabel: `${metrics.avgResolutionDays.toFixed(1)} dias médio`,
    runsSummary: `${metrics.validRuns}/${metrics.totalRuns} corridas válidas`,
  };
}

/**
 * Helper: Check if analytics data is stale (>30 min old)
 *
 * @param metadata Analytics metadata with lastRefreshAt
 * @returns true if data is stale or metadata unavailable
 */
export function isAnalyticsStale(metadata: AnalyticsMetadata | null): boolean {
  if (!metadata?.lastRefreshAt) return true;
  const ageMs = Date.now() - metadata.lastRefreshAt.getTime();
  return ageMs > 30 * 60 * 1000; // 30 minutes
}
