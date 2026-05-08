/**
 * validators.ts (server — notivisa)
 *
 * Access control + Zod schemas for NOTIVISA callables (Phase 8, ADR-0026).
 *
 * Pattern mirrors `educacao-continuada` and `controle-temperatura`:
 * - assertNotivisaAccess: validates auth + module claim + lab membership
 * - Collection path helpers
 * - Zod input schemas for all callables
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const NOTIVISA_ACCESS_DENIED_MSG =
  'Sem permissão para este módulo — contate o administrador.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Garante (em ordem):
 *   1. Caller autenticado
 *   2. Caller tem claim modules['notivisa'] === true
 *   3. Caller é membro ativo de labs/{labId}/members/{uid}
 *
 * Falhas viram `permission-denied` com mensagem padronizada + log
 * `[NOTIVISA_ACCESS_DENIED]` em Cloud Logging.
 */
export async function assertNotivisaAccess(
  auth: AuthDataLite | undefined,
  labId: string,
): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  const uid = auth.uid;
  const ts = new Date().toISOString();

  const modulesClaim = (auth.token?.['modules'] ?? {}) as Record<string, unknown>;
  if (modulesClaim['notivisa'] !== true) {
    console.error('[NOTIVISA_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'missing_module_claim',
      ts,
    });
    throw new HttpsError('permission-denied', NOTIVISA_ACCESS_DENIED_MSG);
  }

  const memberSnap = await admin
    .firestore()
    .doc(`labs/${labId}/members/${uid}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    console.error('[NOTIVISA_ACCESS_DENIED]', {
      uid,
      labId,
      reason: 'not_active_member',
      ts,
    });
    throw new HttpsError('permission-denied', NOTIVISA_ACCESS_DENIED_MSG);
  }
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function notivisaDraftsCol(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`notivisa-drafts/${labId}/drafts`);
}

export function notivisaQueueCol(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`notivisa-queue/${labId}/events`);
}

export function notivisaOutboxCol(
  db: admin.firestore.Firestore,
  labId: string,
) {
  return db.collection(`notivisa-outbox/${labId}/archives`);
}

export function notivisaLabRoot(db: admin.firestore.Firestore, labId: string) {
  return db.doc(`notivisa-drafts/${labId}`);
}

export async function ensureNotivisaLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = notivisaLabRoot(db, labId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const NotivisaPayloadSchema = z.object({
  versao: z.literal('1.0'),
  laudo_id: z.string().min(1).max(128),
  paciente_cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  data_resultado: z.number().int().positive('Unix timestamp obrigatório'),
  resultados: z
    .array(
      z.object({
        analito: z.string().min(1).max(256),
        valor: z.union([z.number(), z.string()]),
        unidade: z.string().min(1).max(32),
        referencia: z.string().max(256),
      }),
    )
    .min(1, 'Pelo menos um resultado obrigatório'),
  assinador: z.object({
    cpf: z.string().regex(/^\d{11}$/, 'CPF inválido'),
    nome: z.string().min(1).max(256),
    data_assinatura: z.number().int().positive(),
  }),
});

export type NotivisaPayload = z.infer<typeof NotivisaPayloadSchema>;

const LogicalSignatureSchema = z.object({
  hash: z.string().length(64),
  operatorId: z.string().min(1),
  ts: z.number().int().positive(),
});

export type LogicalSignature = z.infer<typeof LogicalSignatureSchema>;

// ─── Callable input schemas ──────────────────────────────────────────────────

/**
 * notivisaDraftCreate — create new draft with idempotency check
 */
export const NotivisaDraftCreateInputSchema = z.object({
  labId: z.string().min(1),
  laudoId: z.string().min(1),
  payload: NotivisaPayloadSchema,
});

export type NotivisaDraftCreateInput = z.infer<typeof NotivisaDraftCreateInputSchema>;

/**
 * approveNotivisaDraft — RT/admin approves draft, transitions to approved status
 */
export const ApproveNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
  signature: LogicalSignatureSchema,
});

export type ApproveNotivisaDraftInput = z.infer<typeof ApproveNotivisaDraftInputSchema>;

/**
 * submitNotivisaDraft — callable submitter, moves to queue, creates audit log entry
 */
export const SubmitNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
  signature: LogicalSignatureSchema.optional(),
});

export type SubmitNotivisaDraftInput = z.infer<typeof SubmitNotivisaDraftInputSchema>;

/**
 * rejectNotivisaDraft — auditor rejects with motivo, transitions back to drafting
 */
export const RejectNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1),
  draftId: z.string().min(1),
  motivo: z.string().min(10, 'Motivo mínimo 10 caracteres').max(500),
  signature: LogicalSignatureSchema,
});

export type RejectNotivisaDraftInput = z.infer<typeof RejectNotivisaDraftInputSchema>;

/**
 * updateResultStatus — mark result as reviewed/released (Phase 4, callable 5)
 */
export const UpdateResultStatusInputSchema = z.object({
  labId: z.string().min(1),
  submissionId: z.string().min(1),
  action: z.enum(['review', 'release']),
  signature: LogicalSignatureSchema,
});

export type UpdateResultStatusInput = z.infer<typeof UpdateResultStatusInputSchema>;

/**
 * fetchTestResults — retrieve completed test results (Phase 4, callable 6)
 */
export const FetchTestResultsInputSchema = z.object({
  labId: z.string().min(1),
  filters: z
    .object({
      status: z.enum(['received', 'reviewed', 'released']).optional(),
      dateRange: z
        .object({
          startTs: z.number().int().positive(),
          endTs: z.number().int().positive(),
        })
        .optional(),
      pacienteCpf: z.string().regex(/^\d{11}$/).optional(),
      submissionId: z.string().optional(),
    })
    .optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
  pageToken: z.string().optional(),
});

export type FetchTestResultsInput = z.infer<typeof FetchTestResultsInputSchema>;

/**
 * validateAuthorization — check NOTIVISA permissions (Phase 4, callable 7)
 */
export const ValidateAuthorizationInputSchema = z.object({
  labId: z.string().min(1),
});

export type ValidateAuthorizationInput = z.infer<typeof ValidateAuthorizationInputSchema>;

/**
 * logAuditTrail — immutable event logging (Phase 4, callable 8)
 */
export const LogAuditTrailInputSchema = z.object({
  labId: z.string().min(1),
  eventType: z.enum([
    'DRAFT_CREATED',
    'DRAFT_SUBMITTED',
    'DRAFT_APPROVED',
    'DRAFT_REJECTED',
    'REQUISITION_SENT',
    'RESULT_RECEIVED',
    'RESULT_REVIEWED',
    'RESULT_RELEASED',
    'ARCHIVE_EXPORTED',
    'CONFIG_CHANGED',
    'AUTH_FAILED',
    'DATA_ACCESS',
    'PERMISSION_GRANTED',
    'PERMISSION_REVOKED',
    'SYSTEM_EVENT',
  ]),
  resourceId: z.string().min(1),
  details: z.record(z.any()).optional(),
  signature: LogicalSignatureSchema,
});

export type LogAuditTrailInput = z.infer<typeof LogAuditTrailInputSchema>;
