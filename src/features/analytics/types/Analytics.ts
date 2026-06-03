/**
 * Analytics Extended Types
 *
 * Complements types/index.ts with richer aggregate shapes for dashboard components.
 * Multi-tenant: all types carry or reference labId at boundaries.
 */

// ─── Core aggregate ───────────────────────────────────────────────────────────

/**
 * Full analytics aggregate stored in Firestore cache.
 * Produced by the hourly Cloud Function; consumed by dashboard hooks.
 */
export interface AnalyticsAggregate {
  labId: string;

  // CIQ compliance
  totalRuns: number;
  validRuns: number;
  invalidRuns: number;
  compliancePercent: number; // 0–100

  // Non-conformities
  openNCs: number;
  closedNCs: number;
  ncResolutionRate: number; // 0–100
  avgResolutionDays: number;

  // Processing
  avgProcessingHours: number;

  // Retrabalho (rework — runs flagged for reprocessing)
  retrabalhoCount: number;
  retrabalhoPercent: number; // (retrabalhoCount / totalRuns) * 100

  // NC by module: module slug → count of open NCs
  ncByModule: Record<string, number>;

  // NC age buckets: key = "<N>d" (e.g. "7d", "30d", "60d", ">60d")
  ncAgeBuckets: {
    '7d': number;
    '30d': number;
    '60d': number;
    '>60d': number;
  };

  // Metadata
  computedAt: Date | null;
  dataAsOf: Date | null;
}

// ─── KPI summary ─────────────────────────────────────────────────────────────

/**
 * Flattened KPI surface shown in ComplianceStatusDash.
 * Derived from AnalyticsAggregate + raw run data via kpiCalculators.
 */
export interface KPISummary {
  compliancePercent: number;
  openNCs: number;
  avgResolutionDays: number;
  retrabalhoPercent: number;
  // Trend relative to prior period (+/- percentage points)
  complianceDelta?: number;
  ncDelta?: number;
}

// ─── CIQ trend data for Levey-Jennings chart ─────────────────────────────────

/**
 * Single observation for a CIQ run (one analyte, one run).
 */
export interface CIQRunObservation {
  runId: string;
  timestamp: Date;
  equipmentId: string;
  equipmentLabel: string;
  analyte: string; // e.g. "WBC", "RBC", "HGB"
  value: number;
  mean: number; // expected mean for this control level
  sd: number; // expected SD for this control level
  zScore: number; // (value - mean) / sd
  isValid: boolean;
}

/**
 * Full dataset for CIQTrendsDash: per-analyte time series.
 */
export interface CIQTrendData {
  analyte: string;
  unit: string;
  mean: number;
  sd: number;
  upperWarning: number; // mean + 2*sd
  lowerWarning: number; // mean - 2*sd
  upperControl: number; // mean + 3*sd
  lowerControl: number; // mean - 3*sd
  observations: CIQRunObservation[];
}

// ─── NC Heatmap data ──────────────────────────────────────────────────────────

/**
 * One cell in the NC heatmap (module × age bucket).
 */
export interface NCHeatmapCell {
  moduleSlug: string;
  moduleLabel: string;
  ageBucket: '7d' | '30d' | '60d' | '>60d';
  count: number;
  /** Normalized intensity 0–1 for color mapping */
  intensity: number;
}

// ─── Training matrix data ─────────────────────────────────────────────────────

/** Certification status for a single trainee × POP pairing. */
export type CertificationStatus = 'valid' | 'expiring' | 'expired' | 'not_trained';

export interface TrainingEntry {
  traineeId: string;
  traineeName: string;
  popId: string;
  popTitle: string;
  certifiedAt: Date | null;
  expiresAt: Date | null;
  status: CertificationStatus;
  daysUntilExpiry: number | null;
}

// ─── Recharts-compatible chart data ──────────────────────────────────────────

/**
 * Single data point for the CIQ composite chart (Recharts).
 */
export interface ChartDataPoint {
  /** X-axis label (formatted date/time) */
  label: string;
  timestamp: number; // epoch ms for sorting
  value: number;
  mean: number;
  upperWarning: number;
  lowerWarning: number;
  upperControl: number;
  lowerControl: number;
  isValid: boolean;
}

/**
 * Treemap node shape (Recharts Treemap).
 */
export interface TreemapNode {
  name: string;
  size: number;
  fill: string;
}
