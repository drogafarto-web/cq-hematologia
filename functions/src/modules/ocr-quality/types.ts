/**
 * OCR Quality Tracking — Types
 *
 * Phase 5 / Task 05-04: Feedback loop + quality tracking for analyzer OCR
 * (Yumizen H550 Gemini Vision + RDT strip classification).
 *
 * Schema lives at:
 *   - ocr-feedback/{labId}/runs/{runId}      — per-run feedback record
 *   - ocr-quality/{labId}/weekly/{weekKey}   — weekly aggregates
 *
 * Compliance:
 *   - DICQ 4.14.7 — continuous improvement KPI (OCR accuracy as quality indicator)
 *   - RDC 978/2025 Art. 86 — PGQ component (post-market surveillance of IA)
 */
import type { LogicalSignature } from '../../shared/signature';

// ─────────────────────────────────────────────────────────────────────────────
// Field-level OCR result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single OCR-extracted field. `value` is normalised to string for diffing —
 * numeric fields keep their original literal (no rounding) so the diff catches
 * RT corrections like `12,4` → `12.4` (locale fixes) AND `12.4` → `13.1`
 * (clinical correction).
 */
export interface OCRField {
  name: string;       // e.g. "WBC", "RBC", "HGB"
  value: string;      // raw extracted value (post-OCR, pre-RT)
  confidence?: number; // optional per-field confidence (0–1)
}

export interface OCRResultSnapshot {
  fields: OCRField[];
  overallConfidence: number;        // global OCR confidence 0–1
  geminiModel?: string;             // 'gemini-2.5-flash'
  promptVariant?: string;           // for A/B tracking
  capturedAt?: number;              // epoch ms
}

export interface FinalResultSnapshot {
  fields: OCRField[];               // RT-validated final values
  finalisedBy: string;              // operator UID
  finalisedAt?: number;             // epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff engine output
// ─────────────────────────────────────────────────────────────────────────────

export type EditKind = 'unchanged' | 'modified' | 'added' | 'removed';

export interface FieldEdit {
  field: string;
  kind: EditKind;
  ocrValue?: string;
  finalValue?: string;
  ocrConfidence?: number;
}

export interface DiffSummary {
  edits: FieldEdit[];
  modifiedCount: number;
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  totalFields: number;
  /** modified+added+removed / totalFields — 0 means perfect, 1 means full rewrite */
  errorRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ocr-feedback/{labId}/runs/{runId}
 *
 * `accepted` is true only when the operator submits the run with zero edits
 * AND overall confidence >= 0.7 (the same threshold that drives auto-retry
 * suggestions). This separates "OCR was perfect" from "OCR needed correction".
 */
export interface OCRFeedbackRun {
  runId: string;
  labId: string;
  ocrResult: OCRResultSnapshot;
  finalResult: FinalResultSnapshot;
  diff: DiffSummary;
  accepted: boolean;
  signature: LogicalSignature;
  operatorId: string;
  ts: any;                          // Firestore Timestamp
  // Surface metadata (denormalised for fast aggregation)
  analyzer?: 'yumizen-h550' | 'rdt-strip' | 'other';
  source?: string;                  // free-form (e.g. captureId from ia-strip)
}

/**
 * Input DTO sent from the client.
 * Audit fields (signature, ts, accepted, diff) are computed server-side.
 */
export interface RecordOCRFeedbackPayload {
  runId: string;
  labId: string;
  ocrResult: OCRResultSnapshot;
  finalResult: FinalResultSnapshot;
  analyzer?: OCRFeedbackRun['analyzer'];
  source?: string;
}

export interface RecordOCRFeedbackResult {
  runId: string;
  diff: DiffSummary;
  accepted: boolean;
  signature: LogicalSignature;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly aggregate
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldErrorPattern {
  field: string;
  /** Times this field was modified by RT */
  modifiedCount: number;
  /** Top distinct (ocrValue → finalValue) corrections, capped at 5 */
  topCorrections: Array<{ ocrValue: string; finalValue: string; count: number }>;
}

export interface OCRWeeklyAggregate {
  labId: string;
  weekKey: string;                  // ISO week e.g. "2026-W19"
  windowStart: number;              // epoch ms (inclusive)
  windowEnd: number;                // epoch ms (exclusive)
  totalRuns: number;
  acceptedRuns: number;
  /** acceptedRuns / totalRuns — primary KPI */
  correctRate: number;
  /** average confidence across all OCR runs in window */
  meanConfidence: number;
  /** Field-level breakdown sorted by modifiedCount desc, capped at 10 */
  mostEditedFields: FieldErrorPattern[];
  /** Lightweight prompt-tuning hints derived from patterns (NOT prescriptive) */
  promptTuningSuggestions: string[];
  computedAt: any;                  // Firestore Timestamp
}
