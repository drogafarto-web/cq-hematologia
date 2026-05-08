/**
 * rtPresenceCheckin — callable for RT presence confirmation.
 *
 * RDC 978/2025 Art. 22 — Responsável Técnico must be continuously present
 * during critical QC operations. Without an active check-in, downstream rules
 * block writes to critical thresholds, bioquimica runs, and CEQ submissions.
 *
 * Responsibilities:
 *   1. Validate access (assertRtPresenceAccess) — requires `modules['rt-presence']` claim + RT role
 *   2. Verify caller is an active RT member of the lab
 *   3. Atomic batch:
 *      - Upsert /labs/{labId}/rt-presenca/current with hasActiveRT=true
 *      - Append /labs/{labId}/rt-presenca-events with chainHash
 *   4. Return { ok: true, checkedInAt: timestamp, sessionId: string }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

import {
  assertRtPresenceAccess,
  ensureRtPresenceLabRoot,
  rtPresenceStatusDoc,
  rtPresenceEventsCol,
  generateSessionId,
  RtPresenceCheckinInputSchema,
} from './validators';

interface CheckinResult {
  ok: true;
  checkedInAt: string; // ISO timestamp
  sessionId: string;
}

const RT_SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const rtPresenceCheckin = onCall<unknown, Promise<CheckinResult>>(
  {},
  async (request) => {
    const parsed = RtPresenceCheckinInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertRtPresenceAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureRtPresenceLabRoot(db, input.labId);

    // Re-read colaborador for nome/crbm snapshot + active flag
    const colabRef = db.doc(
      `educacaoContinuada/${input.labId}/colaboradores/${uid}`,
    );
    const colabSnap = await colabRef.get();
    if (!colabSnap.exists || colabSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Colaborador não encontrado.');
    }
    const colab = colabSnap.data()!;
    if (colab['ativo'] !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Colaborador não está ativo (RN-RT-01).',
      );
    }

    const rtNome = colab['nome'] as string;
    const rtCrbm = (colab['crbm'] as string) || '';

    const nowTs = admin.firestore.Timestamp.now();
    const nowMs = nowTs.toMillis();
    const expiresAtMs = nowMs + RT_SESSION_DURATION_MS;
    const expiresAtTs = admin.firestore.Timestamp.fromMillis(expiresAtMs);
    const sessionId = generateSessionId(input.labId, uid, nowMs);

    const statusPayload = {
      labId: input.labId,
      hasActiveRT: true,
      rtId: uid,
      rtNome,
      rtCrbm,
      checkedInAt: nowTs,
      sessionId,
      expiresAt: expiresAtTs,
      atualizadoEm: nowTs,
    };

    // Compute chainHash from prior rt-presenca-event (if any)
    const eventsCol = rtPresenceEventsCol(db, input.labId);
    const lastEventQ = await eventsCol.orderBy('timestamp', 'desc').limit(1).get();
    const prevHash = lastEventQ.empty
      ? null
      : (lastEventQ.docs[0].data()['chainHash'] as string);

    const eventCanon = JSON.stringify({
      tipo: 'checkin',
      operadorId: uid,
      rtUid: uid,
      sessionId,
      tsMillis: nowMs,
    });
    const eventPayloadHash = sha256(eventCanon);
    const chainHash = sha256(prevHash ? `${prevHash}::${eventPayloadHash}` : eventPayloadHash);

    const eventRef = eventsCol.doc();
    const eventDoc = {
      tipo: 'checkin' as const,
      operadorId: uid,
      rtUid: uid,
      sessionId,
      timestamp: nowTs,
      chainHash,
      chainHashAnterior: prevHash,
    };

    const statusRef = rtPresenceStatusDoc(db, input.labId);
    const batch = db.batch();
    batch.set(statusRef, statusPayload, { merge: true });
    batch.set(eventRef, eventDoc);
    await batch.commit();

    console.log('[RT_PRESENCA_CHECKIN]', {
      labId: input.labId,
      rtUid: uid,
      sessionId,
      operadorId: uid,
    });

    return {
      ok: true,
      checkedInAt: nowTs.toDate().toISOString(),
      sessionId,
    };
  },
);
