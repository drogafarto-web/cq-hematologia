import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import { assertTurnosAccess, escalasCollection, CreateEscalaInputSchema } from './validators';

interface CreateEscalaResult {
  ok: true;
  escalaId: string;
}

export const turnos_createEscala = onCall<unknown, Promise<CreateEscalaResult>>(
  {},
  async (request) => {
    const parsed = CreateEscalaInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const db = admin.firestore();

    const col = escalasCollection(db, input.labId);
    const ref = col.doc();

    const [y, m, d] = input.data.split('-').map(Number);
    const dataTs = admin.firestore.Timestamp.fromDate(new Date(y, m - 1, d));

    await ref.set({
      labId: input.labId,
      data: dataTs,
      turno: input.periodo,
      periodo: input.periodo,
      colaboradores: input.colaboradores,
      rtPresente: input.rtPresente,
      rtSubstitutoPresente: input.rtSubstitutoPresente,
      observacoes: input.observacoes ?? null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletadoEm: null,
    });

    return { ok: true, escalaId: ref.id };
  },
);
