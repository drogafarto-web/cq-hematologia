/**
 * Performance Tracing Utility
 *
 * Creates custom traces for Firebase Performance Monitoring and local profiling.
 * Used to measure specific operations like:
 * - Component render times
 * - Data fetching latency
 * - Interactive operations (form submission, dialog open, etc)
 */

import { getPerformance } from 'firebase/performance';

export interface TraceMetrics {
  [key: string]: number;
}

export interface TraceAttributes {
  [key: string]: string;
}

export class PerformanceTrace {
  private traceName: string;
  private startTime: number;
  private metrics: TraceMetrics = {};
  private attributes: TraceAttributes = {};
  private firebaseTrace: any = null;

  constructor(traceName: string) {
    this.traceName = traceName;
    this.startTime = performance.now();

    // Initialize Firebase trace if available
    try {
      const perfMon = getPerformance();
      if (perfMon) {
        this.firebaseTrace = (perfMon as any).trace(traceName);
      }
    } catch (e) {
      // Firebase Performance not available
    }
  }

  /**
   * Record a custom metric within the trace
   */
  putMetric(name: string, value: number): void {
    this.metrics[name] = value;
    if (this.firebaseTrace) {
      this.firebaseTrace.putMetric(name, value);
    }
  }

  /**
   * Record a custom attribute (string) for the trace
   */
  putAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (this.firebaseTrace) {
      this.firebaseTrace.putAttribute(name, value);
    }
  }

  /**
   * Increment a metric counter
   */
  incrementMetric(name: string, value: number = 1): void {
    const current = this.metrics[name] || 0;
    this.putMetric(name, current + value);
  }

  /**
   * Stop the trace and record total duration
   */
  stop(): TraceMetrics {
    const duration = performance.now() - this.startTime;
    this.putMetric('duration_ms', Math.round(duration));

    if (this.firebaseTrace) {
      try {
        this.firebaseTrace.stop();
      } catch (e) {
        console.warn(`Failed to stop Firebase trace: ${this.traceName}`, e);
      }
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Trace] ${this.traceName}: ${Math.round(duration)}ms`, this.metrics);
    }

    return this.metrics;
  }

  /**
   * Get current metrics without stopping the trace
   */
  getMetrics(): TraceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current attributes without stopping the trace
   */
  getAttributes(): TraceAttributes {
    return { ...this.attributes };
  }
}

/**
 * Measures the duration of an async operation
 * Automatically stops the trace when the promise resolves or rejects
 */
export async function traceAsync<T>(
  traceName: string,
  fn: (trace: PerformanceTrace) => Promise<T>
): Promise<T> {
  const trace = new PerformanceTrace(traceName);
  try {
    const result = await fn(trace);
    trace.stop();
    return result;
  } catch (error) {
    trace.putAttribute('error', 'true');
    trace.stop();
    throw error;
  }
}

/**
 * Measures the duration of a sync operation
 */
export function traceSync<T>(
  traceName: string,
  fn: (trace: PerformanceTrace) => T
): T {
  const trace = new PerformanceTrace(traceName);
  try {
    const result = fn(trace);
    trace.stop();
    return result;
  } catch (error) {
    trace.putAttribute('error', 'true');
    trace.stop();
    throw error;
  }
}

/**
 * Common trace names for standardized monitoring
 */
export const TRACE_NAMES = {
  // List loading
  POPS_LIST_LOAD: 'pops_list_load',
  NC_LIST_LOAD: 'nc_list_load',
  AUDITORIA_LIST_LOAD: 'auditoria_list_load',
  TREINAMENTOS_LIST_LOAD: 'treinamentos_list_load',
  BIOSSEGURANCA_AREAS_LOAD: 'biosseguranca_areas_load',

  // Dialog/form interactions
  NC_DIALOG_OPEN: 'nc_open_dialog',
  POP_DIALOG_OPEN: 'pop_open_dialog',
  AUDIT_DIALOG_OPEN: 'audit_open_dialog',
  TRAINING_DIALOG_OPEN: 'training_open_dialog',

  // Form submission
  NC_CREATE_SUBMIT: 'nc_create_submit',
  POP_CREATE_SUBMIT: 'pop_create_submit',
  AUDIT_CHECKLIST_SUBMIT: 'audit_checklist_submit',

  // Rendering
  AUDIT_CHECKLIST_RENDER: 'audit_checklist_render',
  NC_LIST_RENDER: 'nc_list_render',
  POPS_LIST_RENDER: 'pops_list_render',

  // Data operations
  FIRESTORE_QUERY: 'firestore_query',
  FIRESTORE_WRITE: 'firestore_write',
  FIRESTORE_DELETE: 'firestore_delete',

  // Auth
  AUTH_STATE_CHANGE: 'auth_state_change',
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
} as const;

/**
 * Measures Firestore query performance
 * Tracks query latency, result count, and errors
 */
export function traceFirestoreQuery(
  traceName: string,
  collectionName: string,
  conditions: string[] = []
): PerformanceTrace {
  const trace = new PerformanceTrace(traceName);
  trace.putAttribute('collection', collectionName);
  trace.putAttribute('conditions', conditions.join(', ') || 'none');
  return trace;
}

/**
 * Measures React component render time
 * Use within a component to track render performance
 */
export function usePerformanceTrace(traceName: string) {
  const trace = new PerformanceTrace(traceName);

  return {
    putMetric: (name: string, value: number) => trace.putMetric(name, value),
    putAttribute: (name: string, value: string) => trace.putAttribute(name, value),
    stop: () => trace.stop(),
  };
}

/**
 * Performance monitoring dashboard data collector
 * Collects performance metrics for display in dashboard
 */
export class PerformanceMonitor {
  private traces: Map<string, { duration: number; count: number; total: number }> = new Map();

  recordTrace(traceName: string, duration: number): void {
    const existing = this.traces.get(traceName) || { duration: 0, count: 0, total: 0 };
    existing.count += 1;
    existing.total += duration;
    existing.duration = Math.round(existing.total / existing.count); // Moving average

    this.traces.set(traceName, existing);
  }

  getMetrics() {
    const metrics: Record<string, any> = {};
    for (const [name, data] of this.traces) {
      metrics[name] = {
        avgDuration: data.duration,
        count: data.count,
        totalTime: data.total,
      };
    }
    return metrics;
  }

  reset(): void {
    this.traces.clear();
  }

  exportJSON(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics: this.getMetrics(),
      },
      null,
      2
    );
  }
}

export const performanceMonitor = new PerformanceMonitor();
