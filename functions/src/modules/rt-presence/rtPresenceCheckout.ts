/**
 * rtPresenceCheckout — callable for RT presence closure.
 *
 * RDC 978/2025 Art. 22 — Responsável Técnico confirms end of active duty.
 * Transitions /labs/{labId}/rt-presenca/current from hasActiveRT=true → false
 * and removes the active-RT flag that gates critical QC operations.
 *
 * Responsibilities:
 *   1. Validate access (assertRtPresenceAccess) — requires RT role
 *   2. Verify presença doc exists and sessionId matches
 *   3. Verify caller uid === the RT who checked in
 *   4. Atomic batch:
 *      - Update rt-presenca/current { hasActiveRT: false, checkedOutAt }
 *      - Append rt-presenca-events with chainHash continuity
 *   5. Return { ok: true, checkedOutAt: timestamp, duration: minutes }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

import {
  assertRtPresenceAccess,
  ensureRtPresenceLabRoot,
  rtPresenceStatusDoc,
  rtPresenceEventsCol,
  isValidSessionId,
  RtPresenceCheckoutInputSchema,
} from './validators';

interface CheckoutResult {
  ok: true;
  checkedOutAt: string; // ISO timestamp
  duration: number; // minutes
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const rtPresenceCheckout = onCall<unknown, Promise<CheckoutResult>>({}, async (request) => {
  const parsed = RtPresenceCheckoutInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertRtPresenceAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  await ensureRtPresenceLabRoot(db, input.labId);

  // Read presença status
  const statusRef = rtPresenceStatusDoc(db, input.labId);
  const statusSnap = await statusRef.get();
  if (!statusSnap.exists) {
    throw new HttpsError(
      'failed-precondition',
      'Presença não inicializada para este laboratório (faça checkin primeiro).',
    );
  }
  const status = statusSnap.data()!;

  if (status['hasActiveRT'] !== true) {
    throw new HttpsError('failed-precondition', 'Nenhuma presença de RT ativa para encerramento.');
  }

  const storedSessionId = status['sessionId'];
  if (!isValidSessionId(storedSessionId)) {
    throw new HttpsError(
      'failed-precondition',
      'Presença em estado inconsistente — sessionId inválido.',
    );
  }

  if (input.sessionId !== storedSessionId) {
    throw new HttpsError('permission-denied', 'Session ID não corresponde à presença ativa.');
  }

  const storedRtUid = status['rtId'];
  if (storedRtUid !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Apenas o RT que fez checkin pode encerrar a presença.',
    );
  }

  const nowTs = admin.firestore.Timestamp.now();
  const nowMs = nowTs.toMillis();

  const checkedInAt = (status['checkedInAt'] as admin.firestore.Timestamp).toMillis();
  const durationMs = nowMs - checkedInAt;
  const durationMinutes = Math.round(durationMs / (60 * 1000));

  // Compute chainHash from prior rt-presenca-event
  const eventsCol = rtPresenceEventsCol(db, input.labId);
  const lastEventQ = await eventsCol.orderBy('timestamp', 'desc').limit(1).get();
  const prevHash = lastEventQ.empty ? null : (lastEventQ.docs[0].data()['chainHash'] as string);

  const eventCanon = JSON.stringify({
    tipo: 'checkout',
    operadorId: uid,
    rtUid: uid,
    sessionId: storedSessionId,
    durationMs,
    tsMillis: nowMs,
  });
  const eventPayloadHash = sha256(eventCanon);
  const chainHash = sha256(prevHash ? `${prevHash}::${eventPayloadHash}` : eventPayloadHash);

  const eventRef = eventsCol.doc();
  const eventDoc = {
    tipo: 'checkout' as const,
    operadorId: uid,
    rtUid: uid,
    sessionId: storedSessionId,
    durationMs,
    timestamp: nowTs,
    chainHash,
    chainHashAnterior: prevHash,
  };

  const statusUpdate = {
    hasActiveRT: false,
    rtId: null,
    rtNome: null,
    rtCrbm: null,
    sessionId: null,
    checkedOutAt: nowTs,
    atualizadoEm: nowTs,
  };

  const batch = db.batch();
  batch.set(statusRef, statusUpdate, { merge: true });
  batch.set(eventRef, eventDoc);
  await batch.commit();

  console.log('[RT_PRESENCA_CHECKOUT]', {
    labId: input.labId,
    rtUid: uid,
    sessionId: storedSessionId,
    durationMinutes,
    operadorId: uid,
  });

  return {
    ok: true,
    checkedOutAt: nowTs.toDate().toISOString(),
    duration: durationMinutes,
  };
});
