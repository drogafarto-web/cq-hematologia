/**
 * anomalyTypes.ts
 *
 * Unified type system for advanced auditoria module.
 * Phase 7 Wave 0 — Foundation
 *
 * RDC 978 Art. 107 — Audit trail with anomaly detection
 * DICQ 4.4 — Anomaly monitoring
 */

export type AnomalyDimension =
  | 'operation_rarity'
  | 'time_anomaly'
  | 'result_rarity'
  | 'velocity'
  | 'module_jump';

export interface DimensionScore {
  dimension: AnomalyDimension;
  score: number;
  evidence: string;
}

export interface AnomalyScore {
  entryId: string;
  labId: string;
  operatorId: string;
  overall: number;
  dimensions: DimensionScore[];
  computedAt: number;
  aiInsight?: string;
}

export interface BaselineModel {
  labId: string;
  operatorId: string;
  operationCounts: Record<string, number>;
  moduleFrequency: Record<string, number>;
  hourlyPattern: number[];
  totalEntries: number;
  lastUpdatedAt: number;
}

export interface BaselineStats {
  operationCounts: Record<string, number>;
  moduleFrequency: Record<string, number>;
  hourlyPattern: number[];
  totalEntries: number;
  entropyScore: number;
}

export type AlertSeverity = 'critical' | 'high' | 'medium';
export type AlertStatus = 'active' | 'dismissed' | 'resolved';

export interface AuditAlert {
  id: string;
  labId: string;
  anomalyScore: AnomalyScore;
  severity: AlertSeverity;
  status: AlertStatus;
  routedTo: string[];
  createdAt: number;
  dismissedAt?: number;
  dismissedBy?: string;
  dismissReason?: string;
}

export interface AuditEntry {
  id: string;
  labId: string;
  operatorId: string;
  timestamp: number;
  action: string;
  moduleId: string;
  recordId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFormat = 'pdf' | 'csv';

export interface ReportFilter {
  labId: string;
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  modules?: string[];
  operatorIds?: string[];
  includeAnomalies: boolean;
  includeCompliance: boolean;
}

export interface AuditReport {
  id: string;
  labId: string;
  filter: ReportFilter;
  summary: string;
  entryCount: number;
  anomalyCount: number;
  generatedAt: number;
  downloadUrl?: string;
}
