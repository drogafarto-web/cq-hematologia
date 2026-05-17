import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertTurnosAccess,
  escalasCollection,
  SoftDeleteEscalaInputSchema,
} from './validators';

interface SoftDeleteEscalaResult {
  ok: true;
}

export const turnos_softDeleteEscala = onCall<unknown, Promise<SoftDeleteEscalaResult>>(
  {},
  async (request) => {
    const parsed = SoftDeleteEscalaInputSchema.safeParse(request.data);
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

    await ref.update({
      deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  },
);
