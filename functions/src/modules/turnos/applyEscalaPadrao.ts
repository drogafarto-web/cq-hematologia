import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertTurnosAccess,
  escalasCollection,
  escalaPadraoDoc,
  ApplyEscalaPadraoInputSchema,
} from './validators';

interface ApplyEscalaPadraoResult {
  ok: true;
  created: number;
  skipped: number;
}

export const turnos_applyEscalaPadrao = onCall<unknown, Promise<ApplyEscalaPadraoResult>>(
  {},
  async (request) => {
    const parsed = ApplyEscalaPadraoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertTurnosAccess(request.auth, input.labId);
    const db = admin.firestore();

    const padraoSnap = await escalaPadraoDoc(db, input.labId).get();
    if (!padraoSnap.exists) {
      throw new HttpsError('failed-precondition', 'Nenhuma escala padrão configurada.');
    }

    const padrao = padraoSnap.data()!;
    const diasAtivos = (padrao.diasAtivos ?? []) as number[];
    const turnos = (padrao.turnos ?? []) as Array<{
      periodo: string;
      colaboradores: Array<{ id: string; nome: string; cargo: string }>;
      rtPresente: boolean;
      rtSubstitutoPresente: boolean;
    }>;

    if (turnos.length === 0) {
      throw new HttpsError('failed-precondition', 'Escala padrão não tem turnos configurados.');
    }

    const [y, m, d] = input.weekStartISO.split('-').map(Number);
    const weekStart = new Date(y, m - 1, d);

    const col = escalasCollection(db, input.labId);
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < 7; i++) {
      if (!diasAtivos.includes(i)) {
        skipped++;
        continue;
      }

      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayTs = admin.firestore.Timestamp.fromDate(dayDate);

      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await col
        .where('deletadoEm', '==', null)
        .where('data', '>=', admin.firestore.Timestamp.fromDate(dayStart))
        .where('data', '<=', admin.firestore.Timestamp.fromDate(dayEnd))
        .get();

      if (!existing.empty) {
        skipped++;
        continue;
      }

      const batch = db.batch();
      for (const turno of turnos) {
        const ref = col.doc();
        batch.set(ref, {
          labId: input.labId,
          data: dayTs,
          turno: turno.periodo,
          periodo: turno.periodo,
          colaboradores: turno.colaboradores,
          rtPresente: turno.rtPresente,
          rtSubstitutoPresente: turno.rtSubstitutoPresente,
          observacoes: null,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          deletadoEm: null,
        });
        created++;
      }
      await batch.commit();
    }

    return { ok: true, created, skipped };
  },
);
