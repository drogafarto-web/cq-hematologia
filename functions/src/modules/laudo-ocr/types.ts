/**
 * Laudo OCR — Types + Zod schemas
 *
 * Phase 6 (Wave 3, Agent 5) — RDC 978 Article 167 Compliance
 * OCR extraction of fields 10-12 from clinical reports (laudos)
 *
 * Field 10: Observações (clinical notes)
 * Field 11: RT signature/stamp detection
 * Field 12: Director signature/stamp + date
 *
 * Compliance:
 *   - RDC 978/2025 Art. 167 (laudo field integrity + signatory verification)
 *   - LGPD Art. 9 (PII processing via AI — consent-gated)
 *   - DICQ 4.3 (versioned, signed, traceable extractions)
 */

import { z } from 'zod';

// ─── Bounding Box (signature detection) ──────────────────────────────────────

/**
 * Bounding box coordinates [x_min, y_min, width, height] as percentages (0–100)
 * of the image dimensions. Allows UI to overlay detection zones.
 */
export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(100, 'x must be 0–100'),
  y: z.number().min(0).max(100, 'y must be 0–100'),
  width: z.number().min(0).max(100, 'width must be 0–100'),
  height: z.number().min(0).max(100, 'height must be 0–100'),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// ─── Field 10: Observações ──────────────────────────────────────────────────

/**
 * Free-text clinical notes extracted from laudo field 10.
 * Required field (RDC 978 Art. 167).
 */
export const Field10Schema = z.object({
  text: z.string().min(1, 'Observações required'),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

export type Field10 = z.infer<typeof Field10Schema>;

// ─── Field 11: RT Signature ─────────────────────────────────────────────────

/**
 * RT (Responsável Técnico) signature/stamp detection.
 * Advisory field: if not detected, allow manual fallback entry.
 */
export const Field11Schema = z.object({
  detected: z.boolean().describe('Whether signature/stamp was detected'),
  boundingBox: BoundingBoxSchema.nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  notes: z.string().optional(),
});

export type Field11 = z.infer<typeof Field11Schema>;

// ─── Field 12: Director Signature + Date ────────────────────────────────────

/**
 * Lab director (RT or medical director) signature/stamp + date.
 * Advisory field: date extraction if visible.
 */
export const Field12Schema = z.object({
  detected: z.boolean().describe('Whether signature/stamp was detected'),
  dateText: z.string().nullable().optional().describe('Extracted date text if visible'),
  boundingBox: BoundingBoxSchema.nullable().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  notes: z.string().optional(),
});

export type Field12 = z.infer<typeof Field12Schema>;

// ─── Gemini raw response ─────────────────────────────────────────────────────

/**
 * Wire format the model returns from Gemini Vision.
 */
export const LaudoOCRGeminiResponseSchema = z.object({
  field10: Field10Schema,
  field11: Field11Schema,
  field12: Field12Schema,
  overallConfidence: z.enum(['high', 'medium', 'low']).optional(),
  remarks: z.string().optional(),
});

export type LaudoOCRGeminiResponse = z.infer<typeof LaudoOCRGeminiResponseSchema>;

// ─── Extracted fields (Firestore-stored) ───────────────────────────────────

/**
 * Canonical extraction result stored in Firestore.
 * Denormalized for auditing and UI.
 */
export const LaudoExtractedFieldsSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  field10: Field10Schema,
  field11: Field11Schema,
  field12: Field12Schema,
  source: z.enum(['auto', 'manual']).describe('OCR automated or manual entry'),
  extractedAt: z.any().describe('Firestore Timestamp'),
  extractedBy: z.string().describe('Operator UID or Cloud Function UID'),
  status: z.enum(['completed', 'partial', 'failed']).optional(),
  geminiLatencyMs: z.number().optional(),
  rawGeminiResponse: z.record(z.any()).optional().describe('Full Gemini response for audit'),
});

export type LaudoExtractedFields = z.infer<typeof LaudoExtractedFieldsSchema>;

// ─── Callable input ──────────────────────────────────────────────────────────

/**
 * Request to extract laudo fields via OCR.
 * Input: signed URL to laudo PDF/image in Cloud Storage.
 */
export const ExtractLaudoFieldsInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  laudoId: z.string().min(1, 'laudoId required'),
  storageUrl: z.string().url('Invalid storage URL'),
  patientId: z.string().min(1).optional().describe('For consent validation'),
});

export type ExtractLaudoFieldsInput = z.infer<typeof ExtractLaudoFieldsInputSchema>;

// ─── Callable output ─────────────────────────────────────────────────────────

/**
 * Response from extract callable.
 * On success: extracted fields stored in Firestore.
 * On failure: returns error with allowManualEntry flag.
 */
export interface ExtractLaudoFieldsResult {
  ok: true;
  extraction: LaudoExtractedFields;
  message: string;
}

export interface ExtractLaudoFieldsError {
  ok: false;
  error: string;
  code: 'vision_failed' | 'consent_failed' | 'validation_failed' | 'not_found' | 'unauthorized';
  allowManualEntry: boolean;
}

export type ExtractLaudoFieldsResponse = ExtractLaudoFieldsResult | ExtractLaudoFieldsError;

// ─── Manual entry (fallback) ────────────────────────────────────────────────

/**
 * Fallback: RT can manually enter fields 10-12 if OCR fails.
 */
export const SaveLaudoFieldsManuallyInputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  field10Text: z.string().min(1, 'Field 10 (Observações) required'),
  field11CapturedBy: z.string().optional().describe('RT/Director UID'),
  field12CapturedBy: z.string().optional().describe('Director UID'),
  field11Notes: z.string().optional(),
  field12Notes: z.string().optional(),
  field12Date: z.string().optional().describe('Manual date entry (ISO 8601)'),
});

export type SaveLaudoFieldsManuallyInput = z.infer<typeof SaveLaudoFieldsManuallyInputSchema>;

export interface SaveLaudoFieldsManuallyResult {
  ok: true;
  extraction: LaudoExtractedFields;
  message: string;
}

export interface SaveLaudoFieldsManuallyError {
  ok: false;
  error: string;
}

export type SaveLaudoFieldsManuallyResponse = SaveLaudoFieldsManuallyResult | SaveLaudoFieldsManuallyError;

// ─── Audit trail ───────────────────────────────────────────────────────────

/**
 * Denormalized audit entry for extraction operations.
 */
export interface LaudoOCRAuditEntry {
  action: 'LAUDO_OCR_REQUESTED' | 'LAUDO_OCR_SUCCESS' | 'LAUDO_OCR_FAILED' | 'LAUDO_FIELDS_MANUAL_ENTRY';
  operatorId: string;
  labId: string;
  laudoId: string;
  ts: any; // Firestore Timestamp
  geminiLatencyMs?: number;
  source?: 'auto' | 'manual';
  details?: Record<string, unknown>;
}
