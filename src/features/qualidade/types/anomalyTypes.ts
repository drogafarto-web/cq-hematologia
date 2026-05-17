/**
 * anomalyTypes.ts
 *
 * Unified type system for advanced auditoria (Phase 7).
 * Defines: anomaly detection dimensions, scoring model, baseline, alerts, and reporting.
 *
 * RDC 978 Art. 107 — Anomalies in operation audit trail
 * DICQ 4.4 — Audit monitoring + compliance tracking
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Five dimensions of anomaly detection
 */
export type AnomalyDimension =
  | 'operation_rarity'      // This operator doesn't typically do this action
  | 'time_anomaly'          // Operation outside normal operating hours
  | 'result_rarity'         // Result (pass/fail) deviates from historical pattern
  | 'velocity'              // Burst of operations (e.g., 50 results in 5 min)
  | 'module_jump';          // Operator switching modules unusually fast

/**
 * Score for a single dimension
 * Range: 0-100 (100 = strongest anomaly signal)
 */
export interface DimensionScore {
  dimension: AnomalyDimension;
  score: number;           // 0-100
  evidence: string;        // Human-readable explanation
}

/**
 * Composite anomaly score for an entry or batch
 * Computed server-side from baseline model + current observation
 */
export interface AnomalyScore {
  entryId: string;         // Audit trail entry ID
  labId: string;           // Multi-tenant isolation
  operatorId: string;      // Which operator triggered it
  overallScore: number;    // 0-100, weighted average of dimensions
  dimensions: DimensionScore[];
  computedAt: number;      // Timestamp (ms) when computed
  aiInsight?: string;      // Optional Gemini 2.5 Flash generated summary
}

/**
 * Historical baseline model per operator per lab
 * Used to detect deviations (velocity, rarity, time patterns)
 */
export interface BaselineModel {
  labId: string;
  operatorId: string;
  operationCounts: Record<string, number>;  // actionType -> count
  moduleFrequency: Record<string, number>;  // moduleId -> count
  hourlyPattern: number[];                  // [0-23] distribution of operations by hour
  totalEntries: number;                     // Total ops in baseline window
  lastUpdatedAt: number;                    // Timestamp (ms)
}

/**
 * Severity levels for alerts
 */
export type AlertSeverity = 'critical' | 'high' | 'medium';

/**
 * Status lifecycle for alerts
 */
export type AlertStatus = 'active' | 'investigating' | 'dismissed' | 'resolved';

/**
 * Alert generated when anomaly score exceeds threshold
 * Immutable once created; dismissal records intent but doesn't delete
 */
export interface AuditAlert {
  id: string;
  labId: string;
  anomalyScore: AnomalyScore;  // Full context of the anomaly
  severity: AlertSeverity;      // critical|high|medium
  status: AlertStatus;          // active|dismissed|resolved
  routedTo: string[];           // userIds of RT/auditor who can see this
  createdAt: number;            // Timestamp (ms)
  dismissedAt?: number;         // When marked dismissed
  dismissedBy?: string;         // userId who dismissed it
  dismissReason?: string;       // Optional context: "false positive", "investigated", etc.
}

/**
 * Report period granularity
 */
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Export format for audit reports
 */
export type ReportFormat = 'pdf' | 'csv';

/**
 * Filters for audit report generation
 */
export interface ReportFilter {
  labId: string;
  period: ReportPeriod;
  startDate?: Date;              // For custom period
  endDate?: Date;                // For custom period
  modules?: string[];            // Filter by module IDs
  operatorIds?: string[];        // Filter by operator UIDs
  includeAnomalies: boolean;     // Include anomaly score summary
  includeCompliance: boolean;    // Include RDC 978 / DICQ compliance score
}

/**
 * Generated audit report
 * Server-side PDF/CSV export with audit trail + anomalies + compliance metrics
 */
export interface AuditReport {
  id: string;
  labId: string;
  filter: ReportFilter;
  summary: {
    entryCount: number;
    anomalyCount: number;
    severityBreakdown: {
      critical: number;
      high: number;
      medium: number;
    };
    complianceScore: number;     // 0-100 based on RDC 978 / DICQ coverage
  };
  generatedAt: number;           // Timestamp (ms)
  downloadUrl?: string;          // GCS signed URL for PDF/CSV blob
}
