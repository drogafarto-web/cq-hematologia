/**
 * revokePatientConsent.ts (server — consents module)
 *
 * Cloud Function callable: `revokePatientConsent`
 *
 * Marks a patient's AI-processing consent as revoked. Sets `revokedAt` to a
 * server timestamp and keeps the record (no delete — LGPD audit trail must
 * preserve history of what was consented to and when it was withdrawn).
 *
 * After revocation, `consentGate` (ia-strip) will start refusing classify
 * calls for that patient with 'consent-not-captured'.
 *
 * Auth: any active lab member.
 * Audit: writes `consent-revoked` event to `auditLogs/` via shared helper.
 *
 * Note: revoking a consent that does not exist is treated as `not-found`
 * rather than a silent no-op, to surface client bugs (e.g. wrong patientId).
 */

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  RevokeConsentInputSchema,
  assertConsentsWriteAccess,
  consentDocRef,
} from './validators';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

export const revokePatientConsent = onCall(
  { region: 'southamerica-east1', enforceAppCheck: false },
  async (request) => {
    const auth = request.auth;
    const data = request.data ?? {};

    const { uid } = await assertConsentsWriteAccess(auth, data?.labId);

    let input;
    try {
      input = RevokeConsentInputSchema.parse(data);
    } catch (error: any) {
      throw new HttpsError(
        'invalid-argument',
        `Entrada inválida: ${error?.message ?? 'payload malformado'}`,
      );
    }

    const db = admin.firestore();
    const ref = consentDocRef(db, input.labId, input.patientId);
    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        'not-found',
        'Consentimento não encontrado para este paciente.',
      );
    }

    const serverTs = admin.firestore.FieldValue.serverTimestamp();

    await ref.set(
      {
        revokedAt: serverTs,
        revokedBy: uid,
        revokeReason: input.reason ?? null,
        lastUpdated: serverTs,
      },
      { merge: true },
    );

    await writeAuditLog({
      action: 'consent-revoked',
      callerUid: uid,
      targetId: input.patientId,
      labId: input.labId,
      payload: {
        reason: input.reason ?? null,
        previousConsentVersion: snap.data()?.['consentVersion'] ?? null,
        previousScope: snap.data()?.['scope'] ?? [],
      },
    });

    return {
      ok: true,
      labId: input.labId,
      patientId: input.patientId,
      revokedBy: uid,
    };
  },
);
