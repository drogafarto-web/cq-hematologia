import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

// ─── Result Enum ──────────────────────────────────────────────────────────────

export enum ImunoResult {
  NEGATIVE = 'negative',
  POSITIVE = 'positive',
  INCONCLUSIVE = 'inconclusive',
}

// ─── ImunoIAClassification ────────────────────────────────────────────────────
/**
 * API response from Gemini Vision for IA Strip classification.
 * Captures the Vision model's assessment of an immunology strip image.
 *
 * Firestore path (temporary): labs/{labId}/notivisa-drafts/{draftId}/ia-classification/{classId}
 * Or derived field on strip-run during submit.
 *
 * RDC 978 Art.167 — Laudo eletrônico com IA requer consentimento do paciente.
 * LGPD Art.9 — Dados sensíveis de saúde exigem consentimento específico.
 */
export interface ImunoIAClassification {
  id: string;
  labId: string;

  // ── IA Response ────────────────────────────────────────────────────────────
  /** Primary analyte detected (ex: 'HIV', 'Syphilis', 'HepB') */
  analyte: string;

  /** Classification result from Gemini Vision */
  result: ImunoResult;

  /** Confidence score from Gemini (0.0–1.0) — typically 0.90–0.99 for clear strips */
  confidence: number;

  /** Raw OCR text extracted from strip image (pre-parsed) */
  rawText: string;

  // ── Audit Trail ────────────────────────────────────────────────────────────
  /** Operator who submitted the strip for classification */
  operatorId: string;

  /** HMAC-SHA256 signature of canonical classification record */
  hash: string;

  /** Timestamp of classification (set by Gemini Cloud Function) */
  createdAt: Timestamp;

  // ── Metadata ───────────────────────────────────────────────────────────────
  /** URI/path to the strip image in Cloud Storage (gs://bucket/path) */
  imageUrl: string;

  /** Model identifier used (ex: 'gemini-2.5-flash', 'gemini-2.0-vision') */
  modelVersion: string;

  /** Optional error message if classification failed */
  error?: string;
}

// ─── ImunoIAUploadRequest ──────────────────────────────────────────────────────
/**
 * Client payload for submitting a strip image to IA classification.
 * Includes file metadata and audit context — sent to Cloud Function callable.
 *
 * RDC 978 Art.167 — consent must be present before classify().
 * LGPD Art.9 — explicit patient consent documented in auditLog.
 */
export interface ImunoIAUploadRequest {
  labId: string;

  /** ID of the strip-run being classified */
  stripId: string;

  /** Cloud Storage reference URL (client uploads to bucket first, then calls classify) */
  referenceUrl: string;

  /** UID of operator initiating classification */
  uploadedBy: string;

  /** ISO-8601 timestamp of upload */
  uploadedAt: string;

  /** Patient consent recorded (RDC 978 Art.167 + LGPD Art.9) */
  patientConsentId?: string;
}

// ─── ImunoIADatasetRecord ──────────────────────────────────────────────────────
/**
 * Training data record for accuracy evaluation and model improvement.
 * Captures IA classification vs. manual verification by RT.
 *
 * Firestore path: labs/{labId}/ia-dataset/{recordId}
 * Append-only; immutable after first save (soft-delete only).
 *
 * RDC 978 Art.128 — accuracy tracking required for regulatory audits.
 * DICQ 4.3.4.2 — controle contínuo de equipamentos (extends to IA models).
 */
export interface ImunoIADatasetRecord {
  id: string;
  labId: string;

  // ── Classification vs Verdict ──────────────────────────────────────────────
  /** Original classification from Gemini Vision */
  aiClassification: ImunoIAClassification;

  /** Manual verdict from RT (overrides IA if discrepant) */
  manualVerdict: {
    result: ImunoResult;
    operatorId: string;
    justification: string;
    verifiedAt: Timestamp;
  };

  // ── Accuracy Metrics ───────────────────────────────────────────────────────
  /** Delta: true if aiClassification.result === manualVerdict.result */
  isAccurate: boolean;

  /**
   * Absolute difference in confidence (IA confidence vs. RT estimated certainty).
   * Example: IA=0.95, RT estimated 0.92 → delta=0.03.
   * Null if RT confidence not recorded.
   */
  confidenceDelta?: number;

  // ── Dataset Status ─────────────────────────────────────────────────────────
  /** true when record is exported to model training pipeline */
  exported: boolean;

  /** Timestamp of export (null if not yet exported) */
  exportedAt?: Timestamp;

  // ── Audit Trail ────────────────────────────────────────────────────────────
  createdAt: Timestamp;
  createdBy: string;

  /** Soft-delete marker (RN-06) */
  deletedAt?: Timestamp;
  deletedBy?: string;
}

// ─── ImunoIAAccuracy ───────────────────────────────────────────────────────────
/**
 * Monthly accuracy metrics dashboard record.
 * Pre-computed aggregate of classification accuracy across all strips in a lab.
 *
 * Firestore path: labs/{labId}/ia-metrics/{YYYY-MM}
 * Updated daily at 00:00 UTC via scheduled Cloud Function.
 *
 * DICQ 4.3.4.2 — conformidade contínua documentada em métricas mensais.
 * RDC 978 Art.128 — auditoria de desempenho de equipamentos.
 */
export interface ImunoIAAccuracy {
  id: string;
  labId: string;

  // ── Period ─────────────────────────────────────────────────────────────────
  /** YYYY-MM format (ex: '2026-05') */
  period: string;

  // ── Accuracy Metrics ───────────────────────────────────────────────────────
  /** Percentage of strips where aiClassification === manualVerdict (0–100) */
  accuracyPct: number;

  /** Threshold (0.0–1.0) used to flag strips for manual review (default: 0.85) */
  confidenceThreshold: number;

  /** Total records in dataset for this month */
  datasetSize: number;

  /** Number of records below threshold (required follow-up) */
  belowThreshold: number;

  // ── Metadata ───────────────────────────────────────────────────────────────
  /** Timestamp of metric calculation */
  calculatedAt: Timestamp;

  /** UID of operator/system that calculated metrics */
  calculatedBy: string;
}

// ─── Zod Validators ───────────────────────────────────────────────────────────

export const ImunoResultSchema = z.enum(
  [ImunoResult.NEGATIVE, ImunoResult.POSITIVE, ImunoResult.INCONCLUSIVE],
  {
    required_error: 'Resultado é obrigatório (negative, positive, inconclusive).',
  },
);

/**
 * Zod validator for ImunoIAClassification payload.
 * Enforces confidence threshold (default 0.85) and audit fields.
 * Does NOT include id/labId — service assigns those server-side.
 */
export const ImunoIAClassificationPayloadSchema = z
  .object({
    analyte: z.string().min(1, 'Analito é obrigatório.'),
    result: ImunoResultSchema,
    confidence: z
      .number()
      .min(0, 'Confiança deve ser ≥ 0.')
      .max(1, 'Confiança deve ser ≤ 1.'),
    rawText: z.string().min(1, 'Texto bruto da strip é obrigatório.'),
    operatorId: z.string().min(1, 'ID do operador é obrigatório.'),
    hash: z.string().length(64, 'Hash deve ter 64 caracteres (HMAC-SHA256).'),
    imageUrl: z.string().url('URL da imagem deve ser válida.'),
    modelVersion: z.string().min(1, 'Versão do modelo é obrigatória.'),
    error: z.string().optional(),
  })
  // Enforce confidence threshold — strips below 0.85 require manual review
  .refine((d) => d.confidence >= 0.85 || d.error, {
    message: 'Confiança abaixo de 0.85 requer erro ou revisão manual.',
    path: ['confidence'],
  });

export type ImunoIAClassificationPayload = z.infer<
  typeof ImunoIAClassificationPayloadSchema
>;

/**
 * Zod validator for ImunoIAUploadRequest.
 * Validates client submission before Cloud Function callable.
 */
export const ImunoIAUploadRequestSchema = z.object({
  labId: z.string().min(1, 'Lab ID é obrigatório.'),
  stripId: z.string().min(1, 'Strip ID é obrigatório.'),
  referenceUrl: z.string().url('URL de referência deve ser válida.'),
  uploadedBy: z.string().min(1, 'Operador é obrigatório.'),
  uploadedAt: z.string().datetime('Data de upload deve estar em ISO-8601.'),
  patientConsentId: z.string().optional(),
});

export type ImunoIAUploadRequestType = z.infer<typeof ImunoIAUploadRequestSchema>;

/**
 * Zod validator for ImunoIADatasetRecord.
 * Validates training data before storage in Firestore.
 */
export const ImunoIADatasetRecordPayloadSchema = z.object({
  aiClassification: ImunoIAClassificationPayloadSchema,
  manualVerdict: z.object({
    result: ImunoResultSchema,
    operatorId: z.string().min(1, 'Operador é obrigatório.'),
    justification: z.string().min(10, 'Justificação deve ter ≥ 10 caracteres.'),
  }),
  isAccurate: z.boolean(),
  confidenceDelta: z.number().optional(),
  exported: z.boolean().default(false),
});

export type ImunoIADatasetRecordPayload = z.infer<
  typeof ImunoIADatasetRecordPayloadSchema
>;

/**
 * Zod validator for ImunoIAAccuracy metrics.
 * Enforces period format (YYYY-MM) and percentage ranges.
 */
export const ImunoIAAccuracyPayloadSchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Período deve estar em formato YYYY-MM.'),
    accuracyPct: z
      .number()
      .min(0, 'Acurácia deve ser ≥ 0%.')
      .max(100, 'Acurácia deve ser ≤ 100%.'),
    confidenceThreshold: z
      .number()
      .min(0, 'Threshold deve ser ≥ 0.')
      .max(1, 'Threshold deve ser ≤ 1.')
      .default(0.85),
    datasetSize: z.number().min(0, 'Tamanho do dataset deve ser ≥ 0.'),
    belowThreshold: z
      .number()
      .min(0, 'Registros abaixo do threshold devem ser ≥ 0.'),
  })
  // Validate: belowThreshold ≤ datasetSize
  .refine((d) => d.belowThreshold <= d.datasetSize, {
    message: 'Registros abaixo do threshold não podem exceder tamanho do dataset.',
    path: ['belowThreshold'],
  });

export type ImunoIAAccuracyPayload = z.infer<typeof ImunoIAAccuracyPayloadSchema>;

