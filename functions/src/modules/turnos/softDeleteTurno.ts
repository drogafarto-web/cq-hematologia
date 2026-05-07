/**
 * turnos_softDeleteTurno — callable for soft-deleting a supervisor shift registration.
 *
 * RN-TURNO-04: deleção lógica only (never hard-delete).
 *
 * Sets `deletadoEm = serverTimestamp()` and appends audit event with chainHash
 * continuity (resolves RN-TURNO-05).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertTurnosAccess,
  turnosCollection,
  SoftDeleteTurnoInputSchema,
} from './validators';

interface SoftDeleteTurnoResult {
  ok: true;
}

export const turnos_softDeleteTurno = onCall<unknown, Promise<SoftDeleteTurnoResult>>(
  {},
  async (request) => {
    const parsed = SoftDeleteTurnoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const turnosCol = turnosCollection(db, input.labId);
    const turnoRef = turnosCol.doc(input.turnoId);
    const turnoSnap = await turnoRef.get();

    if (!turnoSnap.exists) {
      throw new HttpsError('not-found', 'Turno não encontrado.');
    }

    // Append soft-delete audit event
    const nowTs = admin.firestore.Timestamp.now();
    const auditEventRef = turnoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'softdeleted',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: undefined,
      chainHash: '', // Will be computed by trigger
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(turnoRef, {
      deletadoEm: nowTs,
    });
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return { ok: true };
  },
);
