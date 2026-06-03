/**
 * validators.ts (server — consents module)
 *
 * Auth guard + Zod schemas for patient AI-processing consent records.
 *
 * Why this module exists:
 *   Wave 1 added `consentGate` (functions/src/modules/ia-strip/guardrails/consentGate.ts)
 *   which refuses the Gemini call unless `consents/{labId}/patients/{patientId}` has
 *   `iaProcessing: true`, `consentedAt`, no `revokedAt`. Wave 1 also locked the
 *   collection rule to server-side writes only. Without these callables the
 *   gate is unreachable in production — every classify call would 412.
 *
 * Compliance:
 *   - LGPD Art. 7º + 11 — patient must give explicit, specific, informed consent
 *     before sensitive health data (image of biological strip) is processed by AI.
 *   - DICQ 4.4 / RDC 978 Art. 128 — every consent capture / revocation must
 *     leave an immutable audit trail. We delegate to the shared writeAuditLog
 *     helper (with retry + fallback collection) instead of re-rolling logic.
 *
 * Operator captures consent on behalf of the patient (paper form signed in
 * person, then operator records it in the system). Operator UID is the
 * `capturedBy` field. The patient identifier is `patientId`.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

export const CONSENTS_ACCESS_DENIED_MSG =
  'Sem permissão para registrar consentimento — usuário inativo ou não pertence a este laboratório.';

interface AuthDataLite {
  uid: string;
  token?: Record<string, unknown>;
}

/**
 * Both record + revoke require an active lab member. There is no role
 * restriction — any operator (técnico, RT, admin) can capture or revoke
 * consent because the regulatory burden is "the lab captured it", not
 * "the senior captured it". Audit log preserves WHO did it.
 */
export async function assertConsentsWriteAccess(
  auth: AuthDataLite | undefined,
  labId: string,
  firestore?: admin.firestore.Firestore,
): Promise<{ uid: string }> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  }

  if (!labId || typeof labId !== 'string') {
    throw new HttpsError('invalid-argument', 'labId obrigatório.');
  }

  const db = firestore ?? admin.firestore();
  const memberSnap = await db.doc(`labs/${labId}/members/${auth.uid}`).get();

  if (!memberSnap.exists || memberSnap.data()?.['active'] !== true) {
    // eslint-disable-next-line no-console
    console.error('[CONSENTS_ACCESS_DENIED]', {
      uid: auth.uid,
      labId,
      reason: 'not_active_member',
      ts: new Date().toISOString(),
    });
    throw new HttpsError('permission-denied', CONSENTS_ACCESS_DENIED_MSG);
  }

  return { uid: auth.uid };
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function consentDocRef(db: admin.firestore.Firestore, labId: string, patientId: string) {
  return db.doc(`consents/${labId}/patients/${patientId}`);
}

export async function ensureConsentsLabRoot(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const ref = db.doc(`consents/${labId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ labId }, { merge: true });
  }
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

/**
 * Scope is an enum kept extensible: today only `ia-strip` is wired to the
 * consentGate; tomorrow `ia-laudo` and `analytics` will be added when the
 * relevant flows ship. Storing as an array on the doc lets us union scopes
 * over time without rewriting history.
 */
export const ConsentScopeSchema = z.enum(['ia-strip', 'ia-laudo', 'analytics']);
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

const PatientIdSchema = z
  .string()
  .min(1, 'patientId obrigatório')
  .max(120, 'patientId longo demais (máx 120)');

const ConsentVersionSchema = z
  .string()
  .min(1, 'consentVersion obrigatório')
  .max(64, 'consentVersion longo demais (máx 64)')
  .regex(/^[A-Za-z0-9._-]+$/, 'consentVersion aceita apenas [A-Za-z0-9._-]');

export const RecordConsentInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  patientId: PatientIdSchema,
  consentVersion: ConsentVersionSchema,
  /**
   * Optional override of who captured the consent. Defaults to the caller UID
   * (the operator running the callable). Allowed values are still validated:
   * if provided, must be a non-empty string. We do NOT trust this to bypass
   * auth — the caller UID is always what the audit log records.
   */
  capturedBy: z.string().min(1).max(128).optional(),
  scope: z
    .array(ConsentScopeSchema)
    .min(1, 'scope deve conter ao menos um item')
    .default(['ia-strip']),
});

export type RecordConsentInput = z.infer<typeof RecordConsentInputSchema>;

export const RevokeConsentInputSchema = z.object({
  labId: z.string().min(1, 'labId obrigatório'),
  patientId: PatientIdSchema,
  reason: z.string().max(500).optional(),
});

export type RevokeConsentInput = z.infer<typeof RevokeConsentInputSchema>;
