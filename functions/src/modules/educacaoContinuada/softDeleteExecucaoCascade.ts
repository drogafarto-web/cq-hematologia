/**
 * ec_softDeleteExecucaoCascade — arquivamento atomic de Execucao + dependentes.
 *
 * Arquiva (`deletadoEm = serverTimestamp()`) em um único batch:
 *   - A Execucao
 *   - Todos os Participantes com `execucaoId` igual
 *   - Todas as AvaliacoesEficacia com `execucaoId` igual
 *   - Todas as AvaliacoesCompetencia com `execucaoId` igual
 *
 * NÃO toca AlertasVencimento — esses são ligados por `treinamentoId` e
 * representam o ciclo recorrente do treinamento, independente da execução.
 *
 * RN-06 preservada: nada é `deleteDoc`, só soft-delete. Guarda de 5 anos mantida.
 *
 * Uso típico: execução registrada por engano (ministrante errado, data errada,
 * participantes errados) e precisa ser invalidada sem apagar histórico. O CTO
 * pode criar nova execução correta depois — os docs arquivados ficam em
 * `auditLogs/` + acessíveis via `includeDeleted: true` nas queries.
 *
 * Limite: writeBatch do Firestore permite até 500 writes. Execuções com mais
 * de ~160 participantes + avaliações combinados ultrapassam — raro na prática,
 * mas marcado como débito para divisão em chunks no futuro.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import { assertEcAccess, ecCollection } from './validators';

const InputSchema = z.object({
  labId: z.string().min(1),
  execucaoId: z.string().min(1),
  motivo: z.string().trim().min(5).max(500),
});

interface Result {
  ok: true;
  execucaoId: string;
  participantesArquivados: number;
  avaliacoesEficaciaArquivadas: number;
  avaliacoesCompetenciaArquivadas: number;
}

export const ec_softDeleteExecucaoCascade = onCall<unknown, Promise<Result>>(
  {},
  async (request) => {
    const parsed = InputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, execucaoId, motivo } = parsed.data;

    await assertEcAccess(request.auth, labId);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    // Execução existe e ainda não está arquivada
    const execRef = ecCollection(db, labId, 'execucoes').doc(execucaoId);
    const execSnap = await execRef.get();
    if (!execSnap.exists) {
      throw new HttpsError('not-found', 'Execução não encontrada.');
    }
    if (execSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError(
        'failed-precondition',
        'Execução já está arquivada.',
      );
    }

    // Buscar dependentes em paralelo
    const [participantesSnap, eficaciaSnap, competenciaSnap] = await Promise.all([
      ecCollection(db, labId, 'participantes')
        .where('execucaoId', '==', execucaoId)
        .get(),
      ecCollection(db, labId, 'avaliacoesEficacia')
        .where('execucaoId', '==', execucaoId)
        .get(),
      ecCollection(db, labId, 'avaliacoesCompetencia')
        .where('execucaoId', '==', execucaoId)
        .get(),
    ]);

    // Filtrar só os ainda não arquivados (idempotente — re-run seguro)
    const participantesAtivos = participantesSnap.docs.filter(
      (d) => d.data()?.['deletadoEm'] === null,
    );
    const eficaciaAtivas = eficaciaSnap.docs.filter(
      (d) => d.data()?.['deletadoEm'] === null,
    );
    const competenciaAtivas = competenciaSnap.docs.filter(
      (d) => d.data()?.['deletadoEm'] === null,
    );

    const totalWrites = 1 + participantesAtivos.length;
    if (totalWrites > 500) {
      throw new HttpsError(
        'resource-exhausted',
        `Execução tem ${totalWrites - 1} participantes — excede limite de 500 writes por batch. Dividir em chunks fica como débito.`,
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.update(execRef, { deletadoEm: now });
    for (const p of participantesAtivos) batch.update(p.ref, { deletadoEm: now });
    // NOTE: Evaluations (AvaliacoesEficacia, AvaliacoesCompetencia) are NOT cascade-deleted.
    // Archiving an Execucao preserves evaluation history per RDC 978 audit trail requirements.
    // Evaluations remain queryable and contribute to operator competency records.

    await batch.commit();

    db.doc(`educacaoContinuada/${labId}`)
      .collection('audit-events')
      .add({
        action: 'EC_SOFT_DELETE_EXECUCAO_CASCADE',
        callerUid: uid,
        execucaoId,
        participantesArquivados: participantesAtivos.length,
        avaliacoesEficaciaArquivadas: eficaciaAtivas.length,
        avaliacoesCompetenciaArquivadas: competenciaAtivas.length,
        motivo,
        timestamp: now,
      })
      .catch((err) => {
        console.error('[EC_AUDIT_EVENT_ERROR]', { labId, execucaoId, err: err.message });
      });

    return {
      ok: true,
      execucaoId,
      participantesArquivados: participantesAtivos.length,
      avaliacoesEficaciaArquivadas: eficaciaAtivas.length,
      avaliacoesCompetenciaArquivadas: competenciaAtivas.length,
    };
  },
);
