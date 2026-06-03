/**
 * turnos_supervisorCheckout — callable for in-person supervisor presence closure.
 *
 * RDC 978/2025 Art. 122 + DICQ 4.1.2.7 — supervisor confirms shift closure.
 * Transitions /labs/{labId}/turnos/{id}/presenca/current from `active` → `closed`
 * and removes the active-supervisor flag in /labs/{labId}/supervisor-status/current.
 *
 * Responsibilities:
 *   1. Validate access (assertTurnosAccess)
 *   2. Verify presença doc exists, status === 'active'
 *   3. Verify caller uid === supervisorAtivo.uid (the one who checked in)
 *   4. Atomic batch:
 *      - Update presenca/current { status: 'closed', fechadoEm }
 *      - Append presenca-events with chainHash continuity (RN-PRESENCA-05)
 *      - Update labs/{labId}/supervisor-status/current { hasActiveSupervisor: false }
 *   5. Return { ok, presencaStatus: 'closed' }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

import {
  assertTurnosAccess,
  ensureTurnosLabRoot,
  presencaDoc,
  presencaEventsCol,
  labSupervisorStatusDoc,
  SupervisorCheckoutInputSchema,
} from './validators';

interface CheckoutResult {
  ok: true;
  presencaStatus: 'closed';
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const ObservacoesSchema = SupervisorCheckoutInputSchema.extend({});
// Schema already covers labId+turnoId. We accept observacoes via raw request data
// to keep the existing schema un-touched in this surgical change.

export const turnos_supervisorCheckout = onCall<unknown, Promise<CheckoutResult>>(
  {},
  async (request) => {
    const parsed = ObservacoesSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;
    const observacoesRaw = (request.data as Record<string, unknown> | undefined)?.['observacoes'];
    const observacoes =
      typeof observacoesRaw === 'string' && observacoesRaw.length > 0
        ? observacoesRaw.slice(0, 500)
        : null;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureTurnosLabRoot(db, input.labId);

    // Read presença
    const presencaRef = presencaDoc(db, input.labId, input.turnoId);
    const presencaSnap = await presencaRef.get();
    if (!presencaSnap.exists) {
      throw new HttpsError(
        'failed-precondition',
        'Presença não inicializada para este turno (faça checkin primeiro).',
      );
    }
    const presenca = presencaSnap.data()!;

    if (presenca['status'] === 'closed') {
      throw new HttpsError('failed-precondition', 'Turno já encerrado.');
    }
    if (presenca['status'] !== 'active') {
      throw new HttpsError(
        'failed-precondition',
        `Checkout exige status 'active' (atual: ${presenca['status']}).`,
      );
    }

    const supervisorAtivo = presenca['supervisorAtivo'] as
      | { uid: string; isSubstitute: boolean }
      | undefined;
    if (!supervisorAtivo || typeof supervisorAtivo['uid'] !== 'string') {
      throw new HttpsError('failed-precondition', 'Presença em estado inconsistente.');
    }
    if (supervisorAtivo['uid'] !== uid) {
      throw new HttpsError(
        'permission-denied',
        'Apenas o supervisor que fez checkin pode encerrar o turno.',
      );
    }

    const nowTs = admin.firestore.Timestamp.now();

    // Compute chainHash from prior presenca-event
    const eventsCol = presencaEventsCol(db, input.labId, input.turnoId);
    const lastEventQ = await eventsCol.orderBy('timestamp', 'desc').limit(1).get();
    const prevHash = lastEventQ.empty ? null : (lastEventQ.docs[0].data()['chainHash'] as string);

    const eventCanon = JSON.stringify({
      tipo: 'checkout',
      operadorId: uid,
      supervisorUid: supervisorAtivo['uid'],
      isSubstitute: Boolean(supervisorAtivo['isSubstitute']),
      observacoes,
      tsMillis: nowTs.toMillis(),
    });
    const eventPayloadHash = sha256(eventCanon);
    const chainHash = sha256(prevHash ? `${prevHash}::${eventPayloadHash}` : eventPayloadHash);

    const eventRef = eventsCol.doc();
    const eventDoc = {
      tipo: 'checkout' as const,
      operadorId: uid,
      supervisorUid: supervisorAtivo['uid'],
      isSubstitute: Boolean(supervisorAtivo['isSubstitute']),
      reason: observacoes,
      timestamp: nowTs,
      chainHash,
      chainHashAnterior: prevHash,
    };

    const presencaUpdate = {
      status: 'closed' as const,
      atualizadoEm: nowTs,
      fechadoEm: nowTs,
      observacoesFechamento: observacoes,
    };

    const labStatusRef = labSupervisorStatusDoc(db, input.labId);
    const labStatusUpdate = {
      labId: input.labId,
      hasActiveSupervisor: false,
      turnoAtivoId: null,
      supervisorAtivoUid: null,
      supervisorAtivoNome: null,
      supervisorAtivoIsSubstitute: false,
      atualizadoEm: nowTs,
    };

    const batch = db.batch();
    batch.set(presencaRef, presencaUpdate, { merge: true });
    batch.set(eventRef, eventDoc);
    batch.set(labStatusRef, labStatusUpdate, { merge: true });
    await batch.commit();

    console.log('[TURNO_PRESENCA_CHECKOUT]', {
      labId: input.labId,
      turnoId: input.turnoId,
      supervisorUid: supervisorAtivo['uid'],
      operadorId: uid,
    });

    return { ok: true, presencaStatus: 'closed' };
  },
);
