/**
 * Firebase Performance Monitoring Configuration
 *
 * Initializes Firebase Performance Monitoring with custom traces for:
 * - Module-level list loading (POPs, NC, Auditoria, Treinamentos, Biosseguranca)
 * - Interactive operations (dialog opens, form submissions)
 * - Firestore query performance
 * - Custom alert thresholds
 */

import { getPerformance } from 'firebase/performance';
import app from '../config/firebase.config';

/**
 * Alert thresholds for performance monitoring
 * Metrics exceeding these values should trigger alerts
 */
export const PERFORMANCE_ALERT_THRESHOLDS = {
  // Web Vitals
  LCP_WARNING: 2500, // ms - target <2.5s
  LCP_CRITICAL: 3000, // ms - alert if >3s
  INP_WARNING: 200, // ms - target <200ms
  INP_CRITICAL: 300, // ms - alert if >300ms
  CLS_WARNING: 0.1, // unitless
  CLS_CRITICAL: 0.25, // unitless

  // Custom traces
  LIST_LOAD_WARNING: 1000, // ms - target <1s
  LIST_LOAD_CRITICAL: 1500, // ms - alert if >1.5s
  DIALOG_OPEN_WARNING: 500, // ms - target <500ms
  DIALOG_OPEN_CRITICAL: 1000, // ms - alert if >1s
  FIRESTORE_QUERY_WARNING: 500, // ms - P95 target
  FIRESTORE_QUERY_CRITICAL: 1000, // ms - alert if >1s
};

/**
 * Initializes Firebase Performance Monitoring
 * Must be called after Firebase app is initialized
 */
export function initFirebasePerformance() {
  try {
    // Initialize performance monitoring
    const perf = getPerformance();

    if (perf) {
      console.log('[Firebase] Performance Monitoring initialized');

      // Register custom metric handlers for alert thresholds
      registerMetricAlertHandlers();

      // Log alert thresholds in development
      if (import.meta.env.DEV) {
        console.log('[Performance] Alert thresholds configured:', PERFORMANCE_ALERT_THRESHOLDS);
      }
    }
  } catch (error) {
    console.warn('[Firebase] Performance Monitoring not available:', error);
  }
}

/**
 * Register metric handlers to check alert thresholds
 * In production, these would trigger actual alerts
 */
function registerMetricAlertHandlers() {
  // This is where alert logic would be integrated
  // In production, you would:
  // 1. Listen to trace data via Firebase API
  // 2. Compare against PERFORMANCE_ALERT_THRESHOLDS
  // 3. Send to logging service (Sentry, DataDog, etc)
  // 4. Create dashboard alerts

  if (import.meta.env.DEV) {
    console.log('[Performance] Alert handlers registered');
  }
}

/**
 * Custom trace factory for common module operations
 * Usage: const trace = createModuleTrace('pops_list_load');
 */
export function createModuleTrace(traceName: string) {
  try {
    const perf = getPerformance();
    if (perf) {
      return (perf as any).trace(traceName);
    }
  } catch (error) {
    console.warn(`Failed to create trace: ${traceName}`, error);
  }
  return null;
}

/**
 * Reports a custom metric to Firebase Performance Monitoring
 */
export function reportCustomMetric(traceName: string, metricName: string, value: number) {
  try {
    const perf = getPerformance();
    if (perf) {
      const trace = (perf as any).trace(traceName);
      trace.putMetric(metricName, value);
      trace.stop();
    }
  } catch (error) {
    console.warn(`Failed to report metric: ${traceName}.${metricName}`, error);
  }
}

/**
 * Checks if a metric exceeds alert threshold
 * Returns alert level or null if within acceptable range
 */
export function checkMetricThreshold(
  metricName: string,
  value: number
): 'warning' | 'critical' | null {
  const warningKey = `${metricName}_WARNING` as keyof typeof PERFORMANCE_ALERT_THRESHOLDS;
  const criticalKey = `${metricName}_CRITICAL` as keyof typeof PERFORMANCE_ALERT_THRESHOLDS;

  const warning = PERFORMANCE_ALERT_THRESHOLDS[warningKey];
  const critical = PERFORMANCE_ALERT_THRESHOLDS[criticalKey];

  if (critical !== undefined && value > critical) return 'critical';
  if (warning !== undefined && value > warning) return 'warning';
  return null;
}

/**
 * Metrics to monitor per module (configured in Firebase Console)
 */
export const MODULE_METRICS = {
  POPS: {
    traceName: 'pops_list_load',
    critical_threshold: PERFORMANCE_ALERT_THRESHOLDS.LIST_LOAD_CRITICAL,
  },
  NC: {
    traceName: 'nc_open_dialog',
    critical_threshold: PERFORMANCE_ALERT_THRESHOLDS.DIALOG_OPEN_CRITICAL,
  },
  AUDITORIA: {
    traceName: 'audit_checklist_render',
    critical_threshold: PERFORMANCE_ALERT_THRESHOLDS.LIST_LOAD_CRITICAL,
  },
  TREINAMENTOS: {
    traceName: 'treinamentos_list_load',
    critical_threshold: PERFORMANCE_ALERT_THRESHOLDS.LIST_LOAD_CRITICAL,
  },
  BIOSSEGURANCA: {
    traceName: 'biosseguranca_areas_load',
    critical_threshold: PERFORMANCE_ALERT_THRESHOLDS.LIST_LOAD_CRITICAL,
  },
};

/**
 * Dashboard endpoint configuration for real-time monitoring
 * In production, integrate with a monitoring service like:
 * - Google Cloud Monitoring
 * - Firebase Dashboard
 * - Datadog
 * - New Relic
 */
export const MONITORING_CONFIG = {
  // Dashboard endpoints
  firebase_dashboard: 'https://console.firebase.google.com/project/hmatologia2/performance',
  cloud_monitoring: 'https://console.cloud.google.com/monitoring/dashboards',

  // Alert channels
  alert_channels: {
    email: 'drogafarto@gmail.com',
    slack: import.meta.env.VITE_SLACK_WEBHOOK_URL || null,
    pagerduty: import.meta.env.VITE_PAGERDUTY_KEY || null,
  },

  // Sampling configuration
  sampling: {
    // Collect 100% of traces in production for critical operations
    critical_traces: 1.0,
    // Sample 10% of regular traces to reduce ingestion costs
    regular_traces: 0.1,
  },

  // Data retention
  retention_days: 30,
};

/**
 * Export performance-related environment variables for use in components
 */
export const PERFORMANCE_ENV = {
  ENABLE_WEB_VITALS: import.meta.env.VITE_ENABLE_WEB_VITALS !== 'false',
  ENABLE_FIREBASE_PERF: import.meta.env.VITE_ENABLE_FIREBASE_PERF !== 'false',
  ENABLE_CUSTOM_TRACES: import.meta.env.VITE_ENABLE_CUSTOM_TRACES !== 'false',
  DEBUG_PERFORMANCE: import.meta.env.VITE_DEBUG_PERFORMANCE === 'true',
};
