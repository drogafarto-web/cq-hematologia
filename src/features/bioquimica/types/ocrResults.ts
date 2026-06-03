/**
 * bioquimica/types/ocrResults.ts
 *
 * Types for Gemini Vision OCR parsing pipeline. Zero logic.
 * Captures OCR-extracted analyte names, values, units, and confidence scores.
 *
 * Compliance: RDC 978 Art. 167 (laudo digitalization), LGPD Art. 9 (sensitive data).
 */

import type { AnalitoId } from './_shared_refs';

// ─── Confidence Levels ────────────────────────────────────────────────────

export type OCRConfidence = 'high' | 'medium' | 'low';

// high: ≥ 0.85
// medium: 0.6–0.85
// low: < 0.6

// ─── Parsed Analyte (single extraction from OCR) ──────────────────────────

export interface OCRParsedAnalyte {
  rawName: string; // exactly as it appeared in OCR text
  matchedAnalitoId?: AnalitoId; // post fuzzy-match (assigned by SA-49)
  matchConfidence: OCRConfidence;
  rawValue: string; // e.g. "84.3" or "<0.01"
  parsedValue?: number; // post numeric parse; undefined if non-numeric
  rawUnit?: string; // e.g. "U/L", "mg/dL"
  unitMatched: boolean; // whether unit was recognized
}

// ─── Full OCR Result (output of Gemini Vision callable) ───────────────────

export interface OCRParsedResult {
  imageStoragePath: string;
  imageHash: string; // SHA-256 (64 hex chars)
  parsedAt: number; // unix timestamp
  geminiModel: 'gemini-2.5-flash' | 'gemini-2.0-flash';
  rawText: string; // full OCR text (may be redacted before storage for privacy)
  analytes: OCRParsedAnalyte[];
  overallConfidence: OCRConfidence;
  warnings: string[]; // e.g. "image rotated 90°", "partial occlusion bottom-left"
}

// ─── OCR Validation Report (output of validation service) ────────────────

export interface OCRValidationReport {
  parsedResultId: string;
  expectedAnalytes: AnalitoId[]; // analytes the run was configured for
  matched: AnalitoId[]; // expected analytes found in OCR
  unmatched: AnalitoId[]; // expected but missing in OCR
  unexpected: string[]; // OCR found names not in expected set
  validationSeverity: 'accept' | 'review' | 'reject';
}
