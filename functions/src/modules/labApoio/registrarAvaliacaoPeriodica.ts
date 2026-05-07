/**
 * labApoio_registrarAvaliacaoPeriodica — callable for recording annual evaluation (Art. 39).
 *
 * Appends evaluation to avaliacaoPeriodica[] (history-preserving, never overwrites).
 * Auto-updates proximaAvaliacaoEm = data + 365 days.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertLabApoioAccess,
  labApoioCollection,
  RegistrarAvaliacaoInputSchema,
} from './validators';

interface RegistrarAvaliacaoResult {
  ok: true;
}

export const labApoio_registrarAvaliacaoPeriodica = onCall<unknown, Promise<RegistrarAvaliacaoResult>>(
  {},
  async (request) => {
    const parsed = RegistrarAvaliacaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertLabApoioAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const labApoioCol = labApoioCollection(db, input.labId);
    const contratoRef = labApoioCol.doc(input.contratoId);
    const contratoSnap = await contratoRef.get();

    if (!contratoSnap.exists) {
      throw new HttpsError('not-found', 'Contrato não encontrado.');
    }

    // Validate evaluation date <= today
    const avalData = input.avaliacao.data;
    const evalDate =
      typeof avalData === 'object' && 'toDate' in avalData ? avalData.toDate() : new Date(avalData);
    if (evalDate.getTime() > Date.now()) {
      throw new HttpsError('invalid-argument', 'Data da avaliação não pode ser no futuro.');
    }

    // Append evaluation to history
    const existingAvals = contratoSnap.data()?.avaliacaoPeriodica ?? [];
    const novaAvaliacao = {
      id: db.collection('dummy').doc().id, // Generate ID
      data: input.avaliacao.data,
      resultado: input.avaliacao.resultado,
      responsavel: input.avaliacao.responsavel,
      responsavelNome: input.avaliacao.responsavelNome,
      observacoes: input.avaliacao.observacoes ?? undefined,
      anexoUrl: input.avaliacao.anexoUrl ?? undefined,
    };

    // Compute próxima avaliação = data + 365 dias
    const proximaAvalDate = new Date(evalDate);
    proximaAvalDate.setFullYear(proximaAvalDate.getFullYear() + 1);
    const proximaAvaliacaoTs = admin.firestore.Timestamp.fromDate(proximaAvalDate);

    const nowTs = admin.firestore.Timestamp.now();
    const auditEventRef = contratoRef.collection('events').doc();
    const auditEvent = {
      tipo: 'avaliacao-registrada',
      operadorId: uid,
      timestamp: nowTs,
      mudancas: [
        {
          campo: 'avaliacaoPeriodica',
          anterior: `${existingAvals.length} avaliações anteriores`,
          novo: `${existingAvals.length + 1} avaliações (nova: ${novaAvaliacao.resultado})`,
        },
      ],
      chainHash: '',
      chainHashAnterior: null,
    };

    const batch = db.batch();
    batch.update(contratoRef, {
      avaliacaoPeriodica: [...existingAvals, novaAvaliacao],
      proximaAvaliacaoEm: proximaAvaliacaoTs,
    });
    batch.set(auditEventRef, auditEvent);
    await batch.commit();

    return { ok: true };
  },
);
