/**
 * Firestore Query Profiler — Lightweight debugging utility.
 *
 * Usage:
 *   import { profileQuery } from 'src/utils/firestoreQueryProfiler';
 *
 *   // Profile a single operation
 *   profileQuery('fetch-laudo', () => getDoc(ref));
 *
 *   // Profile in hooks
 *   useEffect(() => {
 *     profileQuery('subscribe-runs', () => {
 *       return onSnapshot(query(collection(...)), (snap) => {
 *         setRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 *       });
 *     });
 *   }, []);
 */

export interface QueryMetric {
  operation: string;
  duration: number;
  timestamp: string;
  warn: boolean;
}

const WARN_THRESHOLD_MS = 500; // Alert if query takes >500ms
const metrics: QueryMetric[] = [];

export const profileQuery = async <T>(
  operation: string,
  fn: () => Promise<T> | (() => void)
): Promise<T | undefined> => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    const warn = duration > WARN_THRESHOLD_MS;

    const metric: QueryMetric = { operation, duration, timestamp, warn };
    metrics.push(metric);

    if (warn) {
      console.warn(
        `⚠️ [Firestore] Slow query: "${operation}" took ${duration.toFixed(0)}ms (threshold: ${WARN_THRESHOLD_MS}ms)`
      );
    } else if (import.meta.env.VITE_DEBUG_FIRESTORE === 'true') {
      console.log(`✓ [Firestore] "${operation}": ${duration.toFixed(0)}ms`);
    }

    return result as T;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`✗ [Firestore] "${operation}" failed after ${duration.toFixed(0)}ms:`, error);
    throw error;
  }
};

/**
 * Get profiler stats (e.g., for reporting)
 */
export const getProfilerStats = () => {
  if (metrics.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      slowQueries: 0,
      totalTime: 0,
    };
  }

  const totalTime = metrics.reduce((sum, m) => sum + m.duration, 0);
  const avgDuration = totalTime / metrics.length;
  const slowQueries = metrics.filter(m => m.warn).length;

  return {
    count: metrics.length,
    avgDuration: Math.round(avgDuration),
    slowQueries,
    totalTime: Math.round(totalTime),
    metrics: metrics.slice(-10), // Last 10 for quick review
  };
};

/**
 * Clear metrics (call after session/page navigation)
 */
export const clearProfilerMetrics = () => {
  metrics.length = 0;
};

/**
 * Log current metrics to console (for debugging)
 */
export const logProfilerMetrics = () => {
  const stats = getProfilerStats();
  console.table(stats.metrics);
  console.log(
    `Summary: ${stats.count} queries, avg ${stats.avgDuration}ms, ${stats.slowQueries} slow`
  );
};
