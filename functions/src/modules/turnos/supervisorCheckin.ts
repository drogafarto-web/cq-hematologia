/**
 * turnos_supervisorCheckin — callable for in-person supervisor presence confirmation.
 *
 * RDC 978/2025 Art. 122 + DICQ 4.1.2.7 — supervisor must be physically present
 * during the active shift. Without an `active` checkin, downstream rules block
 * write to runs/laudos that reference this turnoId.
 *
 * Responsibilities:
 *   1. Validate access (assertTurnosAccess) + RT/admin claim if substitute path
 *   2. Re-read turno server-side (must exist + not soft-deleted)
 *   3. Verify supervisorUid matches turno.supervisorId OR existing substituto designation
 *   4. (optional) Validate PIN against colaborador.pinHash if provided
 *   5. Compute window (inicio/fim) — block if checkin outside [inicio - 30min, fim]
 *   6. Atomic batch:
 *      - Upsert /turnos/{id}/presenca/current with status=active
 *      - Append /turnos/{id}/presenca-events with chainHash
 *      - Upsert /labs/{labId}/supervisor-status/current with hasActiveSupervisor=true
 *   7. Return { ok, presencaStatus }
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
  computeTurnoWindow,
  SupervisorCheckinInputSchema,
} from './validators';

interface CheckinResult {
  ok: true;
  presencaStatus: 'active';
  isSubstitute: boolean;
}

const CHECKIN_EARLY_GRACE_MS = 30 * 60 * 1000; // can checkin up to 30min early

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const turnos_supervisorCheckin = onCall<unknown, Promise<CheckinResult>>(
  {},
  async (request) => {
    const parsed = SupervisorCheckinInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    await ensureTurnosLabRoot(db, input.labId);

    // Read turno
    const turnoRef = db.doc(`labs/${input.labId}/turnos/${input.turnoId}`);
    const turnoSnap = await turnoRef.get();
    if (!turnoSnap.exists) {
      throw new HttpsError('not-found', 'Turno não encontrado.');
    }
    const turno = turnoSnap.data()!;
    if (turno['deletadoEm'] !== null) {
      throw new HttpsError('failed-precondition', 'Turno arquivado.');
    }

    // Determine if checkin is for primary supervisor or pre-designated substitute
    const presencaRef = presencaDoc(db, input.labId, input.turnoId);
    const presencaSnap = await presencaRef.get();
    const existingPresenca = presencaSnap.exists ? presencaSnap.data() : null;

    let isSubstitute = false;
    let substituteOf: string | null = null;
    let substituteReason: string | null = null;

    if (input.supervisorUid === turno['supervisorId']) {
      // Primary supervisor checkin
      isSubstitute = false;
    } else {
      // Must match a previously designated substitute
      const designatedSubUid = existingPresenca?.['designatedSubstituteUid'];
      const designatedReason = existingPresenca?.['designatedSubstituteReason'];
      if (
        !designatedSubUid ||
        designatedSubUid !== input.supervisorUid ||
        typeof designatedReason !== 'string'
      ) {
        throw new HttpsError(
          'permission-denied',
          'Substituto não designado para este turno (use turnos_designateSubstitute primeiro).',
        );
      }
      isSubstitute = true;
      substituteOf = turno['supervisorId'] as string;
      substituteReason = designatedReason;
    }

    // Re-read colaborador for nome/crbm snapshot + active flag
    const colabRef = db.doc(
      `educacaoContinuada/${input.labId}/colaboradores/${input.supervisorUid}`,
    );
    const colabSnap = await colabRef.get();
    if (!colabSnap.exists || colabSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Colaborador não encontrado.');
    }
    const colab = colabSnap.data()!;
    if (colab['ativo'] !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Colaborador não está ativo (RN-TURNO-02).',
      );
    }

    const supervisorNome = colab['nome'] as string;
    const supervisorCrbm = (colab['crbm'] as string) || '';

    // Validate PIN if stored on colaborador
    if (input.pin && colab['pinHash']) {
      const expected = colab['pinHash'] as string;
      const provided = sha256(`${input.supervisorUid}:${input.pin}`);
      if (provided !== expected) {
        throw new HttpsError('permission-denied', 'PIN inválido.');
      }
    }

    // Window check: can checkin from (inicio - 30min) until fim
    const { inicioMs, fimMs } = computeTurnoWindow(
      turno['data'] as string,
      turno['periodo'] as string,
    );
    const nowMs = Date.now();
    const earliestCheckinMs = inicioMs - CHECKIN_EARLY_GRACE_MS;
    if (nowMs < earliestCheckinMs) {
      throw new HttpsError(
        'failed-precondition',
        `Checkin antes da janela permitida (mais de 30min antes do início do turno).`,
      );
    }
    if (nowMs > fimMs) {
      throw new HttpsError(
        'failed-precondition',
        'Turno já encerrado — checkin não permitido.',
      );
    }

    if (existingPresenca?.['status'] === 'closed') {
      throw new HttpsError(
        'failed-precondition',
        'Turno encerrado — não é possível reabrir checkin.',
      );
    }

    const nowTs = admin.firestore.Timestamp.now();
    const inicioTs = admin.firestore.Timestamp.fromMillis(inicioMs);
    const fimTs = admin.firestore.Timestamp.fromMillis(fimMs);

    const supervisorAtivo = {
      uid: input.supervisorUid,
      nome: supervisorNome,
      crbm: supervisorCrbm,
      checkedInAt: nowTs,
      isSubstitute,
      substituteOf,
      substituteReason,
    };

    const presencaPayload = {
      turnoId: input.turnoId,
      labId: input.labId,
      status: 'active' as const,
      supervisorAtivo,
      inicioPlanejado: inicioTs,
      fimPlanejado: fimTs,
      atualizadoEm: nowTs,
      alertaPreEnviado: existingPresenca?.['alertaPreEnviado'] ?? false,
      alertaAusenciaEnviado: existingPresenca?.['alertaAusenciaEnviado'] ?? false,
      // preserve substitute designation fields for audit visibility
      designatedSubstituteUid: existingPresenca?.['designatedSubstituteUid'] ?? null,
      designatedSubstituteReason: existingPresenca?.['designatedSubstituteReason'] ?? null,
    };

    // Compute chainHash from prior presenca-event (if any)
    const eventsCol = presencaEventsCol(db, input.labId, input.turnoId);
    const lastEventQ = await eventsCol.orderBy('timestamp', 'desc').limit(1).get();
    const prevHash = lastEventQ.empty
      ? null
      : (lastEventQ.docs[0].data()['chainHash'] as string);

    const eventCanon = JSON.stringify({
      tipo: 'checkin',
      operadorId: uid,
      supervisorUid: input.supervisorUid,
      isSubstitute,
      tsMillis: nowTs.toMillis(),
    });
    const eventPayloadHash = sha256(eventCanon);
    const chainHash = sha256(prevHash ? `${prevHash}::${eventPayloadHash}` : eventPayloadHash);

    const eventRef = eventsCol.doc();
    const eventDoc = {
      tipo: 'checkin' as const,
      operadorId: uid,
      supervisorUid: input.supervisorUid,
      isSubstitute,
      reason: substituteReason,
      timestamp: nowTs,
      chainHash,
      chainHashAnterior: prevHash,
    };

    const labStatusRef = labSupervisorStatusDoc(db, input.labId);
    const labStatusPayload = {
      labId: input.labId,
      hasActiveSupervisor: true,
      turnoAtivoId: input.turnoId,
      supervisorAtivoUid: input.supervisorUid,
      supervisorAtivoNome: supervisorNome,
      supervisorAtivoIsSubstitute: isSubstitute,
      atualizadoEm: nowTs,
    };

    const batch = db.batch();
    batch.set(presencaRef, presencaPayload, { merge: true });
    batch.set(eventRef, eventDoc);
    batch.set(labStatusRef, labStatusPayload, { merge: true });
    await batch.commit();

    console.log('[TURNO_PRESENCA_CHECKIN]', {
      labId: input.labId,
      turnoId: input.turnoId,
      supervisorUid: input.supervisorUid,
      isSubstitute,
      operadorId: uid,
    });

    return { ok: true, presencaStatus: 'active', isSubstitute };
  },
);
