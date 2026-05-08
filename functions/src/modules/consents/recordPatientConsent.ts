/**
 * recordPatientConsent.ts (server — consents module)
 *
 * Cloud Function callable: `recordPatientConsent`
 *
 * Captures a patient consent for AI processing. Upserts
 * `consents/{labId}/patients/{patientId}` with:
 *   - iaProcessing: true
 *   - consentedAt: serverTimestamp()
 *   - consentVersion (e.g. 'lgpd-v1')
 *   - capturedBy: <operator UID>
 *   - revokedAt: null  (always reset on a fresh capture — re-consenting after
 *                       a previous revocation is intentional)
 *   - scope: string[]  (union of scopes consented to)
 *   - lastUpdated: serverTimestamp()
 *
 * Auth: any active lab member (operator captures on behalf of patient).
 * Audit: writes `consent-captured` event to `auditLogs/` via shared helper.
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  RecordConsentInputSchema,
  assertConsentsWriteAccess,
  consentDocRef,
  ensureConsentsLabRoot,
} from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

export const recordPatientConsent = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const auth = request.auth;
    const data = request.data ?? {};

    // Auth first — guards against unauthenticated calls AND missing labId
    // (the validator checks labId presence before the Firestore lookup).
    const { uid } = await assertConsentsWriteAccess(auth, data?.labId);

    let input;
    try {
      input = RecordConsentInputSchema.parse(data);
    } catch (error: any) {
      throw new HttpsError(
        'invalid-argument',
        `Entrada inválida: ${error?.message ?? 'payload malformado'}`,
      );
    }

    const db = admin.firestore();
    await ensureConsentsLabRoot(db, input.labId);

    const ref = consentDocRef(db, input.labId, input.patientId);

    // Read current scope so a re-capture extends rather than replaces.
    const existingSnap = await ref.get();
    const existingScope = (existingSnap.data()?.['scope'] as string[] | undefined) ?? [];
    const mergedScope = Array.from(new Set([...existingScope, ...input.scope]));

    const serverTs = admin.firestore.FieldValue.serverTimestamp();

    const docPayload = {
      labId: input.labId,
      patientId: input.patientId,
      iaProcessing: true,
      consentedAt: serverTs,
      consentVersion: input.consentVersion,
      capturedBy: input.capturedBy ?? uid,
      revokedAt: null,
      scope: mergedScope,
      lastUpdated: serverTs,
    };

    await ref.set(docPayload, { merge: true });

    // Audit. Best-effort: writeAuditLog has internal retry + fallback collection;
    // we don't fail the user-facing call if audit logging itself blips.
    await writeAuditLog({
      action: 'consent-captured',
      callerUid: uid,
      targetId: input.patientId,
      labId: input.labId,
      payload: {
        consentVersion: input.consentVersion,
        scope: mergedScope,
        capturedBy: docPayload.capturedBy,
        previousScope: existingScope,
        wasRecapture: existingSnap.exists,
      },
    });

    return {
      ok: true,
      labId: input.labId,
      patientId: input.patientId,
      iaProcessing: true,
      consentVersion: input.consentVersion,
      scope: mergedScope,
      capturedBy: docPayload.capturedBy,
    };
  },
);
