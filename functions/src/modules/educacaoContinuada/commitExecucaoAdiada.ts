/**
 * ec_commitExecucaoAdiada — RN-01: marca execução original como 'adiado' e
 * cria nova execução planejada com `origemReagendamento`. Atomic.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertEcAccess,
  CommitExecucaoAdiadaInputSchema,
  ecCollection,
  ensureEcLabRoot,
} from './validators';
import { generateEcSignatureServer } from './signatureCanonical';

interface CommitAdiadaResult {
  ok: true;
  novaExecucaoId: string;
}

export const ec_commitExecucaoAdiada = onCall<unknown, Promise<CommitAdiadaResult>>(
  {},
  async (request) => {
    const parsed = CommitExecucaoAdiadaInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const input = parsed.data;

    await assertEcAccess(request.auth, input.labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const execucoesCol = ecCollection(db, input.labId, 'execucoes');
    const originalRef = execucoesCol.doc(input.execucaoOriginalId);
    const originalSnap = await originalRef.get();
    if (!originalSnap.exists || originalSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Execução original não encontrada ou arquivada.');
    }
    const original = originalSnap.data()!;
    if (original['status'] !== 'planejado') {
      throw new HttpsError(
        'failed-precondition',
        'Apenas execuções planejadas podem ser adiadas.',
      );
    }

    const dataPlanejadaOriginal = original['dataPlanejada'] as admin.firestore.Timestamp;
    if (input.novaDataPlanejada <= dataPlanejadaOriginal.toMillis()) {
      throw new HttpsError(
        'failed-precondition',
        'Nova data precisa ser posterior à data planejada original.',
      );
    }

    await ensureEcLabRoot(db, input.labId);

    const novaDataTs = admin.firestore.Timestamp.fromMillis(input.novaDataPlanejada);

    const assinaturaOriginal = generateEcSignatureServer(uid, {
      execucaoId: input.execucaoOriginalId,
      transicao: 'adiado',
      motivo: input.motivo,
      dataOriginal: dataPlanejadaOriginal.toMillis(),
      novaData: input.novaDataPlanejada,
    });

    const novaRef = execucoesCol.doc();
    const assinaturaNova = generateEcSignatureServer(uid, {
      origemReagendamento: input.execucaoOriginalId,
      dataPlanejada: input.novaDataPlanejada,
      status: 'planejado',
    });

    const batch = db.batch();

    batch.update(originalRef, {
      status: 'adiado',
      assinatura: assinaturaOriginal,
    });

    batch.set(novaRef, {
      labId: input.labId,
      treinamentoId: original['treinamentoId'],
      dataPlanejada: novaDataTs,
      dataAplicacao: null,
      ministrante: original['ministrante'],
      pauta: original['pauta'],
      status: 'planejado',
      origemReagendamento: input.execucaoOriginalId,
      assinatura: assinaturaNova,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      deletadoEm: null,
    });

    await batch.commit();

    db.collection('auditLogs')
      .add({
        action: 'EC_COMMIT_ADIADA',
        callerUid: uid,
        labId: input.labId,
        payload: {
          execucaoOriginalId: input.execucaoOriginalId,
          novaExecucaoId: novaRef.id,
          motivo: input.motivo,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: true, novaExecucaoId: novaRef.id };
  },
);
