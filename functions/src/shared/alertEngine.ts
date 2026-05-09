/**
 * alertEngine.ts
 *
 * Alert generation and routing based on anomaly scores.
 * Maps anomaly dimensions to severity levels and routes to appropriate roles.
 *
 * Phase 7 Wave 2 — SA-10
 * RDC 978 Art. 107 — Alert routing for anomalous operations
 * DICQ 4.4 — Audit alert tracking and compliance
 */

import type { AnomalyDetectionResult } from './anomalyDetector';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'high' | 'medium';

/**
 * Alert routing destinations
 */
export type AlertRoute = 'rt' | 'auditor' | 'admin';

/**
 * Alert routing rule: maps anomaly dimensions to severity and recipients
 */
export interface AlertRoutingRule {
  dimensionThresholds: Record<string, number>;  // {operation_rarity: 0.7, ...}
  overallThreshold: number;  // Overall score threshold
  severity: AlertSeverity;   // Alert severity if matched
  routeTo: AlertRoute[];     // Recipients: rt, auditor, admin
}

/**
 * Generated audit alert
 */
export interface AuditAlert {
  id: string;
  labId: string;
  entryId: string;
  anomalyScore: number;      // Overall composite score
  severity: AlertSeverity;
  status: 'active';           // Fixed at creation
  routedTo: string[];         // User IDs or role names
  createdAt: number;          // Timestamp (ms)
}

/**
 * Classify alert severity based on overall anomaly score
 *
 * @param overall Anomaly score 0-1
 * @returns Severity level
 */
export function classifySeverity(overall: number): AlertSeverity {
  if (overall >= 0.95) return 'critical';
  if (overall >= 0.85) return 'high';
  if (overall >= 0.70) return 'medium';
  return 'medium';  // Threshold not reached, but classifier returns medium as floor
}

/**
 * Route alert to appropriate recipients based on severity and role requirements
 *
 * @param severity Alert severity level
 * @returns Array of recipient role names
 */
export function routeAlert(severity: AlertSeverity): string[] {
  switch (severity) {
    case 'critical':
      return ['rt', 'admin'];
    case 'high':
      return ['rt', 'auditor'];
    case 'medium':
    default:
      return ['auditor'];
  }
}

/**
 * Generate an alert from an anomaly detection result
 * Returns null if anomaly does not meet alert threshold
 *
 * @param anomaly Anomaly detection result
 * @param labId Lab ID for isolation
 * @param alertThreshold Minimum overall score to generate alert (0-1)
 * @returns Generated alert or null if below threshold
 */
export function generateAlert(
  anomaly: AnomalyDetectionResult,
  labId: string,
  alertThreshold: number = 0.85,
): AuditAlert | null {
  // Check if anomaly meets alert threshold
  if (anomaly.overall < alertThreshold) {
    return null;  // Below threshold, no alert needed
  }

  // Classify severity and route
  const severity = classifySeverity(anomaly.overall);
  const routedTo = routeAlert(severity);

  // Generate alert ID (format: lab-entry-timestamp)
  const alertId = `alert-${labId}-${anomaly.entryId}-${Date.now()}`;

  return {
    id: alertId,
    labId,
    entryId: anomaly.entryId,
    anomalyScore: anomaly.overall,
    severity,
    status: 'active',
    routedTo,
    createdAt: Date.now(),
  };
}

/**
 * Determine if an alert should be escalated based on compound conditions
 * Example: velocity + operation_rarity both high = escalate to critical
 *
 * @param anomaly Anomaly detection result
 * @returns Escalated severity or null if no escalation
 */
export function checkEscalation(anomaly: AnomalyDetectionResult): AlertSeverity | null {
  const dimensionMap: Record<string, number> = {};
  for (const dim of anomaly.dimensions) {
    dimensionMap[dim.dimension] = dim.score;
  }

  // Escalation rule: velocity (high) + operation_rarity (high) = critical
  if (
    dimensionMap['velocity'] > 0.7 &&
    dimensionMap['operation_rarity'] > 0.7
  ) {
    return 'critical';
  }

  // Escalation rule: time_anomaly + result_rarity both high = high
  if (
    dimensionMap['time_anomaly'] > 0.6 &&
    dimensionMap['result_rarity'] > 0.6
  ) {
    return 'high';
  }

  return null;
}
