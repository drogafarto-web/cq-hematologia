/**
 * React Hook for Performance Tracing
 *
 * Measures component render times and other performance metrics.
 * Integrates with Firebase Performance Monitoring.
 *
 * Usage:
 * const trace = usePerformanceTrace('pops_list_render');
 * // Component renders...
 * trace.recordMetric('item_count', items.length);
 * trace.stop(); // called in cleanup
 */

import { useEffect, useRef } from 'react';
import { PerformanceTrace, TRACE_NAMES } from './performance-tracing';

export interface UsePerformanceTraceOptions {
  /**
   * Enable tracing (default: true)
   */
  enabled?: boolean;

  /**
   * Auto-stop trace when component unmounts (default: true)
   */
  autoStop?: boolean;

  /**
   * Initial metrics to record
   */
  initialMetrics?: Record<string, number>;

  /**
   * Initial attributes to record
   */
  initialAttributes?: Record<string, string>;

  /**
   * Callback when trace is stopped
   */
  onStop?: (metrics: Record<string, number>) => void;
}

/**
 * Hook to trace performance of a component or operation
 */
export function usePerformanceTrace(traceName: string, options: UsePerformanceTraceOptions = {}) {
  const {
    enabled = true,
    autoStop = true,
    initialMetrics = {},
    initialAttributes = {},
    onStop,
  } = options;

  const traceRef = useRef<PerformanceTrace | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Create new trace
    traceRef.current = new PerformanceTrace(traceName);

    // Record initial metrics and attributes
    Object.entries(initialMetrics).forEach(([name, value]) => {
      traceRef.current?.putMetric(name, value);
    });

    Object.entries(initialAttributes).forEach(([name, value]) => {
      traceRef.current?.putAttribute(name, value);
    });

    // Cleanup on unmount
    return () => {
      if (autoStop && traceRef.current && !stoppedRef.current) {
        const metrics = traceRef.current.stop();
        stoppedRef.current = true;
        if (onStop) {
          onStop(metrics);
        }
      }
    };
  }, [enabled, traceName, autoStop, onStop, initialMetrics, initialAttributes]);

  return {
    /**
     * Record a custom metric within the trace
     */
    recordMetric: (name: string, value: number) => {
      if (traceRef.current && !stoppedRef.current) {
        traceRef.current.putMetric(name, value);
      }
    },

    /**
     * Record a custom attribute (string) for the trace
     */
    recordAttribute: (name: string, value: string) => {
      if (traceRef.current && !stoppedRef.current) {
        traceRef.current.putAttribute(name, value);
      }
    },

    /**
     * Increment a metric counter
     */
    incrementMetric: (name: string, value: number = 1) => {
      if (traceRef.current && !stoppedRef.current) {
        traceRef.current.incrementMetric(name, value);
      }
    },

    /**
     * Stop the trace immediately (normally done automatically on unmount)
     */
    stop: () => {
      if (traceRef.current && !stoppedRef.current) {
        const metrics = traceRef.current.stop();
        stoppedRef.current = true;
        if (onStop) {
          onStop(metrics);
        }
        return metrics;
      }
      return null;
    },

    /**
     * Get current metrics without stopping
     */
    getMetrics: () => traceRef.current?.getMetrics() || {},

    /**
     * Get current attributes without stopping
     */
    getAttributes: () => traceRef.current?.getAttributes() || {},
  };
}

/**
 * Hook to trace a list rendering operation
 *
 * Usage:
 * const listTrace = useListTrace('pops_list_render', items.length);
 */
export function useListTrace(
  traceName: string,
  itemCount: number,
  options?: UsePerformanceTraceOptions,
) {
  const trace = usePerformanceTrace(traceName, {
    ...options,
    initialMetrics: {
      item_count: itemCount,
      ...options?.initialMetrics,
    },
  });

  return {
    ...trace,
    recordItemRendered: () => trace.incrementMetric('rendered_items'),
  };
}

/**
 * Hook to trace data fetching operations
 *
 * Usage:
 * const fetchTrace = useDataFetchTrace('pops_list_load');
 * // ... fetch data
 * fetchTrace.recordMetric('items_loaded', data.length);
 * fetchTrace.recordMetric('latency_ms', endTime - startTime);
 */
export function useDataFetchTrace(traceName: string, options?: UsePerformanceTraceOptions) {
  const startTimeRef = useRef(Date.now());

  const trace = usePerformanceTrace(traceName, {
    ...options,
    initialMetrics: {
      start_time: startTimeRef.current,
      ...options?.initialMetrics,
    },
  });

  return {
    ...trace,
    recordLatency: () => {
      const latency = Date.now() - startTimeRef.current;
      trace.recordMetric('latency_ms', latency);
      return latency;
    },
    recordItemsLoaded: (count: number) => {
      trace.recordMetric('items_loaded', count);
    },
    recordError: (errorMessage: string) => {
      trace.recordAttribute('error', 'true');
      trace.recordAttribute('error_message', errorMessage);
    },
  };
}

/**
 * Hook to trace user interactions (dialog open, form submit, etc)
 *
 * Usage:
 * const interactionTrace = useInteractionTrace('nc_open_dialog');
 * // ... handle interaction
 * interactionTrace.recordMetric('form_fields', fieldCount);
 */
export function useInteractionTrace(traceName: string, options?: UsePerformanceTraceOptions) {
  return usePerformanceTrace(traceName, {
    autoStop: true,
    ...options,
  });
}

/**
 * Hook to trace Firestore queries
 *
 * Usage:
 * const queryTrace = useFirestoreQueryTrace('pops_list_load', 'pops', ['where(labId, ==, X)']);
 * // ... execute query
 * queryTrace.recordMetric('result_count', results.length);
 * queryTrace.recordLatency();
 */
export function useFirestoreQueryTrace(
  traceName: string,
  collection: string,
  conditions: string[] = [],
  options?: UsePerformanceTraceOptions,
) {
  const startTimeRef = useRef(Date.now());

  const trace = usePerformanceTrace(traceName, {
    ...options,
    initialMetrics: {
      start_time: startTimeRef.current,
      ...options?.initialMetrics,
    },
    initialAttributes: {
      collection,
      conditions: conditions.join(', ') || 'none',
      ...options?.initialAttributes,
    },
  });

  return {
    ...trace,
    recordLatency: () => {
      const latency = Date.now() - startTimeRef.current;
      trace.recordMetric('query_latency_ms', latency);
      return latency;
    },
    recordResultCount: (count: number) => {
      trace.recordMetric('result_count', count);
    },
    recordError: (error: Error) => {
      trace.recordAttribute('error', 'true');
      trace.recordAttribute('error_message', error.message);
    },
  };
}
