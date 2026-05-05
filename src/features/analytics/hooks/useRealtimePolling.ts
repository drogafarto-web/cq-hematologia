/**
 * Hook: 30-second real-time polling for analytics meta changes
 *
 * Strategy: poll /labs/{labId}/analytics/meta every 30s via point read (getDoc).
 * Compare lastRefreshAt with cached value in Zustand store.
 * Only re-fetch aggregates when lastRefreshAt changes — avoids redundant reads.
 *
 * Cost: ~1 tiny Firestore read per 30s per active user (negligible).
 * NOT a listener — does not hold an open connection.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getDoc } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAnalyticsStore } from './useAnalyticsCache';
import { analyticsMetaRef } from '../services/analyticsQueries';
import { AnalyticsService } from '../services/analyticsService';

// ─── Constants ────────────────────────────────────────────────────────────────

export const POLL_INTERVAL_MS = 30_000;

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface RealtimePollingState {
  /** True when a poll check is currently in-flight */
  isPolling: boolean;
  /** Date of the most recent completed poll check */
  lastCheckedAt: Date | null;
  /** Seconds until the next poll tick */
  nextCheckIn: number;
}

// ─── Core polling logic (exported for testing) ────────────────────────────────

// Module-level diff state — shared between hook instance and testable helper
let _lastKnownRefreshAt: string | null = null;

/**
 * Performs a single meta check and conditionally refreshes aggregates.
 * Exported for unit testing without React rendering overhead.
 *
 * @param labId Active lab ID
 * @param resetState If true, resets the lastKnown diff state (for test isolation)
 */
export async function checkForUpdatesTestOnly(
  labId: string,
  resetState = false,
): Promise<void> {
  if (resetState) {
    _lastKnownRefreshAt = null;
  }

  let snap: Awaited<ReturnType<typeof getDoc>>;
  try {
    snap = await getDoc(analyticsMetaRef(labId));
  } catch (err) {
    console.warn('[Analytics] Polling check failed:', err);
    return;
  }
  if (!snap.exists()) return;

  const data = snap.data();
  const rawTs = data?.lastRefreshAt;

  // Coerce Firestore Timestamp or Date → ISO string for comparison
  let tsString: string | null = null;
  if (rawTs) {
    if (typeof rawTs.toDate === 'function') {
      tsString = rawTs.toDate().toISOString();
    } else if (rawTs instanceof Date) {
      tsString = rawTs.toISOString();
    } else if (typeof rawTs === 'string') {
      tsString = rawTs;
    }
  }

  if (tsString && tsString !== _lastKnownRefreshAt) {
    _lastKnownRefreshAt = tsString;

    // Update Zustand metadata
    const store = useAnalyticsStore.getState();
    const coercedDate = rawTs?.toDate
      ? rawTs.toDate()
      : rawTs instanceof Date
      ? rawTs
      : null;
    if (coercedDate) {
      store.setMetadata(
        store.metadata
          ? { ...store.metadata, lastRefreshAt: coercedDate }
          : {
              labId,
              lastRefreshAt: coercedDate,
              refreshIntervalMinutes: 60,
              isCached: true,
              cacheExpiresAt: null,
              staleWarningMinutes: 30,
            },
      );
    }

    // Trigger aggregate re-fetch (best-effort)
    try {
      await AnalyticsService.refreshAggregates(labId);
    } catch {
      // Non-critical
    }
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Activates a 30-second polling loop at the analytics hub root.
 *
 * Uses a point read (getDoc) to check analytics-meta.lastRefreshAt.
 * Only triggers aggregate re-fetch when the timestamp has changed.
 *
 * Call once at AnalyticsHub — children read from Zustand store.
 */
export function useRealtimePolling(): RealtimePollingState {
  const labId = useActiveLabId();
  const [isPolling, setIsPolling] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [nextCheckIn, setNextCheckIn] = useState(POLL_INTERVAL_MS / 1000);

  // Per-instance diff state (separate from module-level test helper state)
  const lastKnownRefreshAt = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!labId) return;

    setIsPolling(true);
    try {
      // Point read — not a listener
      const snap = await getDoc(analyticsMetaRef(labId));
      if (!snap.exists()) return;

      const data = snap.data();
      const rawTs = data?.lastRefreshAt;

      // Coerce Firestore Timestamp or Date → ISO string for comparison
      let tsString: string | null = null;
      if (rawTs) {
        if (typeof rawTs.toDate === 'function') {
          tsString = rawTs.toDate().toISOString();
        } else if (rawTs instanceof Date) {
          tsString = rawTs.toISOString();
        } else if (typeof rawTs === 'string') {
          tsString = rawTs;
        }
      }

      // Meta diff guard: only refresh when lastRefreshAt has changed
      if (tsString && tsString !== lastKnownRefreshAt.current) {
        lastKnownRefreshAt.current = tsString;

        const store = useAnalyticsStore.getState();
        const coercedDate = rawTs?.toDate
          ? rawTs.toDate()
          : rawTs instanceof Date
          ? rawTs
          : null;
        if (coercedDate) {
          store.setMetadata(
            store.metadata
              ? { ...store.metadata, lastRefreshAt: coercedDate }
              : {
                  labId,
                  lastRefreshAt: coercedDate,
                  refreshIntervalMinutes: 60,
                  isCached: true,
                  cacheExpiresAt: null,
                  staleWarningMinutes: 30,
                },
          );
        }

        try {
          await AnalyticsService.refreshAggregates(labId);
        } catch {
          // Non-critical: refresh is best-effort
        }
      }

      setLastCheckedAt(new Date());
    } catch (err) {
      console.warn('[Analytics] Polling check failed:', err);
    } finally {
      setIsPolling(false);
    }
  }, [labId]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  const resetCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setNextCheckIn(POLL_INTERVAL_MS / 1000);
    countdownRef.current = setInterval(() => {
      setNextCheckIn((prev) => {
        if (prev <= 1) return POLL_INTERVAL_MS / 1000;
        return prev - 1;
      });
    }, 1_000);
  }, []);

  // ── Main polling effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!labId) return;

    // Run immediately on mount
    checkForUpdates();
    resetCountdown();

    // Then every 30s
    intervalRef.current = setInterval(() => {
      checkForUpdates();
      resetCountdown();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [labId, checkForUpdates, resetCountdown]);

  return { isPolling, lastCheckedAt, nextCheckIn };
}
