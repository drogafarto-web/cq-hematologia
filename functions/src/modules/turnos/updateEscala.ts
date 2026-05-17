import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertTurnosAccess,
  escalasCollection,
  UpdateEscalaInputSchema,
} from './validators';

interface UpdateEscalaResult {
  ok: true;
}

export const turnos_updateEscala = onCall<unknown, Promise<UpdateEscalaResult>>(
  {},
  async (request) => {
    const parsed = UpdateEscalaInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const db = admin.firestore();

    const ref = escalasCollection(db, input.labId).doc(input.escalaId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Escala não encontrada.');
    }
    if (snap.data()?.deletadoEm) {
      throw new HttpsError('failed-precondition', 'Escala já foi removida.');
    }

    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (input.periodo !== undefined) updates.turno = input.periodo;
    if (input.periodo !== undefined) updates.periodo = input.periodo;
    if (input.colaboradores !== undefined) updates.colaboradores = input.colaboradores;
    if (input.rtPresente !== undefined) updates.rtPresente = input.rtPresente;
    if (input.rtSubstitutoPresente !== undefined) updates.rtSubstitutoPresente = input.rtSubstitutoPresente;
    if (input.observacoes !== undefined) updates.observacoes = input.observacoes ?? null;

    await ref.update(updates);

    return { ok: true };
  },
);
