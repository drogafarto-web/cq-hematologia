import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { assertTurnosAccess, escalaPadraoDoc, SaveEscalaPadraoInputSchema } from './validators';

interface SaveEscalaPadraoResult {
  ok: true;
}

export const turnos_saveEscalaPadrao = onCall<unknown, Promise<SaveEscalaPadraoResult>>(
  {},
  async (request) => {
    const parsed = SaveEscalaPadraoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const ref = escalaPadraoDoc(db, input.labId);

    await ref.set(
      {
        labId: input.labId,
        diasAtivos: input.diasAtivos,
        turnos: input.turnos,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: false },
    );

    return { ok: true };
  },
);
