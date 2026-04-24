/**
 * ec_commitExecucaoRealizada — sign-and-write atomic da execução realizada.
 *
 * Cobre RN-03 (≥1 presente), RN-05 (cria alerta de vencimento) e gera
 * assinaturas server-side para execução + cada participante. Server NÃO
 * confia em payload do client para periodicidade/treinamento — re-lê.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  assertEcAccess,
  calcularDataVencimento,
  CommitExecucaoRealizadaInputSchema,
  ecCollection,
  ensureEcLabRoot,
} from './validators';
import { generateEcSignatureServer } from './signatureCanonical';

interface CommitRealizadaResult {
  ok: true;
  execucaoId: string;
  participanteIds: string[];
  alertaId: string;
}

export const ec_commitExecucaoRealizada = onCall<
  unknown,
  Promise<CommitRealizadaResult>
>({}, async (request) => {
  const parsed = CommitExecucaoRealizadaInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
  }
  const input = parsed.data;

  await assertEcAccess(request.auth, input.labId);
  const uid = request.auth!.uid;
  const db = admin.firestore();

  // RN-03 (também validado client; aqui é canônico)
  const presentes = input.presencas.filter((p) => p.presente);
  if (presentes.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'RN-03: ao menos 1 colaborador presente é obrigatório para registrar execução como realizada.',
    );
  }

  // Server reads autoritativos
  const treinRef = ecCollection(db, input.labId, 'treinamentos').doc(input.treinamentoId);
  const treinSnap = await treinRef.get();
  if (!treinSnap.exists || treinSnap.data()?.['deletadoEm'] !== null) {
    throw new HttpsError('not-found', 'Treinamento não encontrado ou arquivado.');
  }
  const periodicidade = treinSnap.data()?.['periodicidade'] as string;

  // Validar colaboradores existem e ativos (1 read por colaborador, paralelo)
  const colaboradoresCol = ecCollection(db, input.labId, 'colaboradores');
  const colSnaps = await Promise.all(
    input.presencas.map((p) => colaboradoresCol.doc(p.colaboradorId).get()),
  );
  for (let i = 0; i < colSnaps.length; i++) {
    const snap = colSnaps[i];
    const cid = input.presencas[i].colaboradorId;
    if (!snap.exists || snap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', `Colaborador ${cid} não encontrado ou arquivado.`);
    }
    if (snap.data()?.['ativo'] !== true) {
      throw new HttpsError('failed-precondition', `Colaborador ${cid} está inativo.`);
    }
  }

  // Re-fetch execução existente se update
  const execucoesCol = ecCollection(db, input.labId, 'execucoes');
  const execRef = input.execucaoId
    ? execucoesCol.doc(input.execucaoId)
    : execucoesCol.doc();

  if (input.execucaoId) {
    const execSnap = await execRef.get();
    if (!execSnap.exists || execSnap.data()?.['deletadoEm'] !== null) {
      throw new HttpsError('not-found', 'Execução não encontrada ou arquivada.');
    }
    const status = execSnap.data()?.['status'];
    if (status === 'realizado') {
      throw new HttpsError(
        'failed-precondition',
        'Execução já registrada como realizada.',
      );
    }
    if (status === 'cancelado') {
      throw new HttpsError(
        'failed-precondition',
        'Execução cancelada não pode ser registrada como realizada.',
      );
    }
  }

  await ensureEcLabRoot(db, input.labId);

  const dataPlanejadaTs = admin.firestore.Timestamp.fromMillis(input.dataPlanejada);
  const dataAplicacaoTs = admin.firestore.Timestamp.fromMillis(input.dataAplicacao);

  // Assinaturas
  const assinaturaExecucao = generateEcSignatureServer(uid, {
    treinamentoId: input.treinamentoId,
    dataAplicacao: input.dataAplicacao,
    status: 'realizado',
    participantes: presentes.length,
  });

  const participantesCol = ecCollection(db, input.labId, 'participantes');
  const participantesPlan = input.presencas.map((p) => {
    const ref = participantesCol.doc();
    const assinatura = generateEcSignatureServer(uid, {
      execucaoId: execRef.id,
      colaboradorId: p.colaboradorId,
      presente: p.presente ? 1 : 0,
      dataAplicacao: input.dataAplicacao,
    });
    return { ref, colaboradorId: p.colaboradorId, presente: p.presente, assinatura };
  });

  const dataVencimento = calcularDataVencimento(dataAplicacaoTs, periodicidade);
  const alertaRef = ecCollection(db, input.labId, 'alertasVencimento').doc();

  // Batch atomic
  const batch = db.batch();

  const execPayload: Record<string, unknown> = {
    treinamentoId: input.treinamentoId,
    dataPlanejada: dataPlanejadaTs,
    dataAplicacao: dataAplicacaoTs,
    ministrante: input.ministrante,
    pauta: input.pauta,
    status: 'realizado',
    assinatura: assinaturaExecucao,
  };

  if (input.execucaoId) {
    batch.update(execRef, execPayload);
  } else {
    batch.set(execRef, {
      labId: input.labId,
      ...execPayload,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      deletadoEm: null,
    });
  }

  for (const p of participantesPlan) {
    batch.set(p.ref, {
      labId: input.labId,
      execucaoId: execRef.id,
      colaboradorId: p.colaboradorId,
      presente: p.presente,
      assinatura: p.assinatura,
      deletadoEm: null,
    });
  }

  batch.set(alertaRef, {
    labId: input.labId,
    treinamentoId: input.treinamentoId,
    dataVencimento,
    status: 'pendente',
    diasAntecedencia: input.diasAntecedenciaAlerta,
  });

  await batch.commit();

  // Audit non-blocking
  db.collection('auditLogs')
    .add({
      action: 'EC_COMMIT_REALIZADA',
      callerUid: uid,
      labId: input.labId,
      payload: {
        execucaoId: execRef.id,
        treinamentoId: input.treinamentoId,
        participanteCount: participantesPlan.length,
        alertaId: alertaRef.id,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  return {
    ok: true,
    execucaoId: execRef.id,
    participanteIds: participantesPlan.map((p) => p.ref.id),
    alertaId: alertaRef.id,
  };
});
