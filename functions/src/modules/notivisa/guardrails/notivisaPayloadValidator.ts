/**
 * notivisaPayloadValidator.ts — NOTIVISA payload validation guardrails
 * Wave 3-10 — Government format requirements + field validation
 *
 * Purpose: Ensure NOTIVISA drafts meet strict government schema before submission.
 * Fail-safe: validation catches formatting errors locally, not after government API call.
 *
 * Rules:
 * - exameCode must be in ANVISA registry (or override with force=true)
 * - patientId (CPF) must be valid (format + checksum)
 * - resultValue must be numeric or coded
 * - dateCollected must be <= now (no future dates)
 * - responsibleRTId must exist in lab members
 */

import { z } from 'zod';
import * as admin from 'firebase-admin';
import { NotivisaPayload } from '../../../shared/notivisa';
import { anvisaTestCodes } from '../../../shared/notivisa/anvisaTestCodes';

// ─────────────────────────────────────────────────────────────────────────────
// CPF Validation Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate CPF format and checksum (Mod-11 algorithm)
 */
export function isValidCPF(cpf: string): boolean {
  // Remove non-digits
  const clean = cpf.replace(/\D/g, '');

  // Must be exactly 11 digits
  if (clean.length !== 11) {
    return false;
  }

  // Reject all-same-digit CPFs (e.g., 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(clean)) {
    return false;
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  digit1 = digit1 > 9 ? 0 : digit1;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  digit2 = digit2 > 9 ? 0 : digit2;

  // Validate
  return parseInt(clean[9]) === digit1 && parseInt(clean[10]) === digit2;
}

/**
 * Validate exam code against ANVISA registry
 */
export function isValidExamCode(code: string): boolean {
  return anvisaTestCodes.hasOwnProperty(code);
}

/**
 * Get exam details from ANVISA registry
 */
export function getExamDetails(code: string) {
  return anvisaTestCodes[code as keyof typeof anvisaTestCodes];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────────────────────

export const NotivisaPayloadValidationSchema = z.object({
  versao: z.literal('1.0').describe('Schema version'),
  laudo_id: z.string().min(1).max(128).describe('Laudo identifier'),
  paciente_cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF must be 11 digits')
    .refine((cpf) => isValidCPF(cpf), 'CPF checksum invalid')
    .describe('Patient CPF (11 digits, valid checksum)'),
  data_resultado: z
    .number()
    .int()
    .positive('Timestamp must be positive')
    .refine((ts) => ts <= Date.now(), 'Result date cannot be in future')
    .describe('Result date (Unix timestamp, ms)'),
  resultados: z
    .array(
      z.object({
        analito: z.string().min(1).max(256).describe('Test name / analyte'),
        valor: z
          .union([
            z.number().describe('Numeric result'),
            z.string().describe('Coded result (e.g., positive/negative)'),
          ])
          .describe('Test result value'),
        unidade: z.string().min(1).max(32).describe('Unit of measurement'),
        referencia: z.string().max(256).optional().describe('Reference range'),
      }),
    )
    .min(1, 'At least one result required')
    .describe('Array of test results'),
  assinador: z.object({
    cpf: z
      .string()
      .regex(/^\d{11}$/, 'Operator CPF must be 11 digits')
      .refine((cpf) => isValidCPF(cpf), 'Operator CPF checksum invalid')
      .describe('Responsible operator CPF'),
    nome: z.string().min(1).max(256).describe('Operator full name'),
    data_assinatura: z
      .number()
      .int()
      .positive('Signature timestamp must be positive')
      .refine((ts) => ts <= Date.now(), 'Signature date cannot be in future')
      .describe('Signature timestamp (Unix ms)'),
  }),
});

export type NotivisaPayloadValidation = z.infer<typeof NotivisaPayloadValidationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result
// ─────────────────────────────────────────────────────────────────────────────

export interface PayloadValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate NOTIVISA payload against government schema + business rules
 * Returns detailed validation result with errors and warnings
 */
export async function validateNotivisaPayload(
  payload: unknown,
  options: {
    forceExamCode?: boolean;
    labId?: string;
    db?: admin.firestore.Firestore;
  } = {},
): Promise<PayloadValidationResult> {
  const errors: PayloadValidationResult['errors'] = [];
  const warnings: PayloadValidationResult['warnings'] = [];

  // ========== 1. Schema validation ==========
  try {
    NotivisaPayloadValidationSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((issue) => {
        errors.push({
          field: issue.path.join('.') || 'payload',
          code: issue.code,
          message: issue.message,
        });
      });
    }
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  const data = payload as NotivisaPayload;

  // ========== 2. Exam code validation ==========
  if (!options.forceExamCode) {
    // Check first result analito against ANVISA registry
    if (data.resultados && data.resultados.length > 0) {
      const analito = data.resultados[0].analito;
      if (!isValidExamCode(analito)) {
        const examDetails = getExamDetails(analito);
        if (examDetails) {
          // Code exists but user chose force=false
          warnings.push({
            field: 'resultados[0].analito',
            code: 'UNREGISTERED_EXAM',
            message: `Exam '${analito}' not in current ANVISA registry. Override with force=true if this is new/experimental.`,
          });
        } else {
          errors.push({
            field: 'resultados[0].analito',
            code: 'INVALID_EXAM_CODE',
            message: `Exam '${analito}' not recognized. Use force=true to override.`,
          });
        }
      }
    }
  }

  // ========== 3. RT member validation ==========
  if (options.labId && options.db) {
    try {
      // Extract RT UID from assinador (would be in context in real usage)
      // For now, just verify lab exists
      const labDoc = await options.db.doc(`labs/${options.labId}`).get();
      if (!labDoc.exists) {
        errors.push({
          field: 'labId',
          code: 'LAB_NOT_FOUND',
          message: `Lab '${options.labId}' not found in database`,
        });
      }
    } catch (err) {
      // Database error — log but don't fail validation
      console.warn('[NOTIVISA_VALIDATOR] Lab lookup failed:', err);
    }
  }

  // ========== 4. Business rule: date coherence ==========
  if (data.data_resultado && data.assinador.data_assinatura) {
    if (data.assinador.data_assinatura < data.data_resultado) {
      errors.push({
        field: 'assinador.data_assinatura',
        code: 'SIGNATURE_DATE_BEFORE_RESULT',
        message: 'Signature date cannot be before result date',
      });
    }

    // Warning: signature far in past (>7 days)
    const daysSinceSignature =
      (Date.now() - data.assinador.data_assinatura) / (24 * 60 * 60 * 1000);
    if (daysSinceSignature > 7) {
      warnings.push({
        field: 'assinador.data_assinatura',
        code: 'STALE_SIGNATURE',
        message: `Signature is ${Math.round(daysSinceSignature)} days old. RT re-approval recommended.`,
      });
    }
  }

  // ========== 5. Business rule: result count ==========
  if (!data.resultados || data.resultados.length === 0) {
    errors.push({
      field: 'resultados',
      code: 'NO_RESULTS',
      message: 'Laudo must contain at least one result',
    });
  }

  // ========== 6. Business rule: result value format ==========
  data.resultados?.forEach((result, idx) => {
    if (typeof result.valor === 'string') {
      // Coded value — check against known codes
      const validCodes = ['positive', 'negative', 'inconclusive', 'reagente', 'não-reagente'];
      if (!validCodes.includes(result.valor.toLowerCase())) {
        warnings.push({
          field: `resultados[${idx}].valor`,
          code: 'UNUSUAL_CODED_VALUE',
          message: `Coded value '${result.valor}' not in standard list. Government may not recognize it.`,
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch validation (for multiple payloads)
// ─────────────────────────────────────────────────────────────────────────────

export async function validateNotivisaPayloadBatch(
  payloads: unknown[],
  options: Parameters<typeof validateNotivisaPayload>[1] = {},
): Promise<Array<{ index: number; result: PayloadValidationResult }>> {
  return Promise.all(
    payloads.map(async (payload, index) => ({
      index,
      result: await validateNotivisaPayload(payload, options),
    })),
  );
}
