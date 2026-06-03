/**
 * Local type definitions for bioquimica Cloud Functions.
 * Mirrors frontend types to avoid cross-project imports that pull in
 * client-side firebase SDK (import.meta.env incompatible with commonjs).
 */

// ─── Shared refs (from _shared_refs.ts) ──────────────────────────────────

export type AnalitoId = string;
export type NivelId = string;
export type EquipmentId = string;

// ─── OCR Results (from types/ocrResults.ts) ──────────────────────────────

export type OCRConfidence = 'high' | 'medium' | 'low';

export interface OCRParsedAnalyte {
  rawName: string;
  matchedAnalitoId?: AnalitoId;
  matchConfidence: OCRConfidence;
  rawValue: string;
  parsedValue?: number;
  rawUnit?: string;
  unitMatched: boolean;
}

export interface OCRParsedResult {
  imageStoragePath: string;
  imageHash: string;
  parsedAt: number;
  geminiModel: 'gemini-2.5-flash' | 'gemini-2.0-flash';
  rawText: string;
  analytes: OCRParsedAnalyte[];
  overallConfidence: OCRConfidence;
  warnings: string[];
}

export interface OCRValidationReport {
  parsedResultId: string;
  expectedAnalytes: AnalitoId[];
  matched: AnalitoId[];
  unmatched: AnalitoId[];
  unexpected: string[];
  validationSeverity: 'accept' | 'review' | 'reject';
}

// ─── Westgard CLSI8 (from types/westgardCLSI.ts) ────────────────────────

export type WestgardRuleCLSI8 = '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10x' | '7T' | '8x' | '12x';

export type WestgardSeverityCLSI8 = 'warn' | 'reject';

export interface WestgardViolationCLSI8 {
  rule: WestgardRuleCLSI8;
  severity: WestgardSeverityCLSI8;
  detectedAt: number;
  windowRuns: string[];
  description: string;
}

// ─── Acceptance Engine (from services/acceptanceEngine.ts) ───────────────

export type AcceptanceDecision = 'accept' | 'warn' | 'reject';

export interface AcceptanceOutput {
  decision: AcceptanceDecision;
  reasons: string[];
  blockers: string[];
}
