/**
 * OCR Yumizen H550 — Types + Zod schemas
 *
 * Phase 5 Task 05-03 — IA OCR Upload + Gemini 2.5 Flash Integration
 *
 * Source of truth for the structured CBC payload extracted from the analyzer
 * screen. Mirrored on the client as a runtime-validated contract.
 *
 * Compliance:
 *   - RDC 978/2025 Art. 167 (laudo data integrity)
 *   - LGPD Art. 9 (PII processing via AI — no patient identifiers in payload)
 *   - DICQ 4.3 (versioned, signed, traceable extractions)
 */

import { z } from 'zod';

// ─── CBC analyte schema ──────────────────────────────────────────────────────

/**
 * 16 standard CBC parameters Yumizen H550 emits. Each is `number | null`
 * (null = analyte not legible). Range constraints are intentionally loose —
 * extreme outliers are still valid clinical findings (e.g. WBC 0.1 in
 * agranulocytosis, PLT 1500 in essential thrombocythemia). Hard rejection
 * lives downstream in the laudo review step, not in the OCR contract.
 */
export const CBCResultSchema = z.object({
  wbc: z.number().nullable(), // 10^3/µL
  rbc: z.number().nullable(), // 10^6/µL
  hgb: z.number().nullable(), // g/dL
  hct: z.number().nullable(), // %
  plt: z.number().nullable(), // 10^3/µL
  mcv: z.number().nullable(), // fL
  mch: z.number().nullable(), // pg
  mchc: z.number().nullable(), // g/dL
  rdw: z.number().nullable(), // %
  mpv: z.number().nullable(), // fL
  neut: z.number().nullable(), // %
  lymph: z.number().nullable(), // %
  mono: z.number().nullable(), // %
  eos: z.number().nullable(), // %
  baso: z.number().nullable(), // %
});

export type CBCResult = z.infer<typeof CBCResultSchema>;

/**
 * Per-field qualitative confidence reported by the model. Lets the UI flag
 * specific cells for operator review without requiring the operator to
 * second-guess every value.
 */
export const FieldConfidenceSchema = z.object({
  wbc: z.enum(['high', 'medium', 'low']).optional(),
  rbc: z.enum(['high', 'medium', 'low']).optional(),
  hgb: z.enum(['high', 'medium', 'low']).optional(),
  hct: z.enum(['high', 'medium', 'low']).optional(),
  plt: z.enum(['high', 'medium', 'low']).optional(),
  mcv: z.enum(['high', 'medium', 'low']).optional(),
  mch: z.enum(['high', 'medium', 'low']).optional(),
  mchc: z.enum(['high', 'medium', 'low']).optional(),
  rdw: z.enum(['high', 'medium', 'low']).optional(),
  mpv: z.enum(['high', 'medium', 'low']).optional(),
  neut: z.enum(['high', 'medium', 'low']).optional(),
  lymph: z.enum(['high', 'medium', 'low']).optional(),
  mono: z.enum(['high', 'medium', 'low']).optional(),
  eos: z.enum(['high', 'medium', 'low']).optional(),
  baso: z.enum(['high', 'medium', 'low']).optional(),
});

export type FieldConfidence = z.infer<typeof FieldConfidenceSchema>;

// ─── Gemini raw response ─────────────────────────────────────────────────────

/**
 * Wire format the model returns. `sampleId` is a string the analyzer printed
 * on screen (NOT a patient identifier — it's the equipment-internal sample
 * counter). Lab-side downstream may, but is not required to, link it to a
 * laudo.
 */
export const OCRYumizenResponseSchema = z.object({
  sampleId: z.string().nullable(),
  values: CBCResultSchema,
  fieldConfidence: FieldConfidenceSchema.optional(),
  overallConfidence: z.enum(['high', 'medium', 'low']),
});

export type OCRYumizenResponse = z.infer<typeof OCRYumizenResponseSchema>;

// ─── Callable input ──────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Cap base64 payload at ~10 MB raw (≈7.5 MB binary post-decode). Cloud
 * Functions onCall hard limit is 10 MB after JSON encoding; we leave headroom
 * for HTTP envelope.
 */
const MAX_BASE64_SIZE = 10 * 1024 * 1024;

export const OCRYumizenInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  base64: z
    .string()
    .min(1, 'Imagem obrigatória')
    .max(MAX_BASE64_SIZE, 'Imagem excede 10MB — comprima antes de enviar'),
  mimeType: z.enum(ALLOWED_MIME, {
    errorMap: () => ({ message: 'Tipo de imagem inválido (jpeg/png/webp)' }),
  }),
});

export type OCRYumizenInput = z.infer<typeof OCRYumizenInputSchema>;

// ─── Callable output ─────────────────────────────────────────────────────────

export interface OCRYumizenResult {
  ok: true;
  /** Idempotency key — `sha256(labId + base64)`. */
  imageHash: string;
  /** True if a previous identical image+lab combination was returned from cache. */
  cached: boolean;
  /** Firestore docId in `ocr-extractions/{labId}/items/{id}`. */
  extractionId: string;
  sampleId: string | null;
  values: CBCResult;
  fieldConfidence?: FieldConfidence;
  overallConfidence: 'high' | 'medium' | 'low';
  /** Wall-clock latency of the Gemini call (excludes Firestore writes). */
  geminiLatencyMs: number;
  /** Audit-log document path for caller's confirmation. */
  auditPath: string;
}

// ─── Audit trail ─────────────────────────────────────────────────────────────

/**
 * Denormalized audit entry. Kept separate from the extraction doc so a future
 * "edit / re-run" cycle can append without rewriting the original AI output.
 */
export interface OCRAuditEntry {
  action:
    | 'OCR_REQUESTED'
    | 'OCR_SUCCESS'
    | 'OCR_FAILED'
    | 'OCR_CACHE_HIT'
    | 'OCR_RATE_LIMITED'
    | 'OCR_OPERATOR_EDIT';
  operatorId: string;
  labId: string;
  imageHash: string;
  ts: FirebaseFirestore.Timestamp;
  geminiLatencyMs?: number;
  overallConfidence?: 'high' | 'medium' | 'low';
  /** Optional details — never include patient PII; sample/equipment IDs only. */
  details?: Record<string, unknown>;
}
