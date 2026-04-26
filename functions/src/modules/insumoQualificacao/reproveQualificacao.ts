/**
 * reproveQualificacao — callable: reprova uma InsumoQualificacao.
 *
 * Sign-and-write atomic (Admin SDK):
 *   1. Auth gate + reauth window (10min) + role RT/biomedico (owner/admin).
 *   2. Gate de tipo: rejeita tira-uro (PR2) e caracterizacao-rt (PR2).
 *   3. motivoReprovacao obrigatório (>=3 chars — Zod).
 *   4. Transação atômica:
 *      a) InsumoQualificacao: status='reprovado', motivoReprovacao,
 *         approvedBy/At/Cargo/Nome, notivisaStatus.
 *      b) Insumo: qcStatus='reprovado', status='segregado',
 *         motivoReprovacao, qcApprovalMethod, qualificacaoId.
 *      c) InsumoMovimentacao tipo='qualificacao' { decision:'reprovado', ... }.
 *      d) Cópia imutável em /labs/{lab}/ciq-audit/qual_{qId}.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  ReproveQualificacaoInputSchema,
  assertQualificacaoAccess,
  loadOperadorInfo,
} from './validators';
import { computeMovimentacaoQualificacaoSignature } from './signatureCanonical';

interface ReproveResult {
  ok: true;
  qId: string;
  insumoId: string;
}

export const reproveQualificacao = onCall<unknown, Promise<ReproveResult>>(
  {},
  async (request) => {
    const parsed = ReproveQualificacaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, qId, motivoReprovacao, notificarNotivisa } = parsed.data;

    const { uid, role } = await assertQualificacaoAccess(request.auth, labId);
    const db = admin.firestore();

    const qRef = db.doc(`labs/${labId}/insumo-qualificacoes/${qId}`);
    const qSnap = await qRef.get();
    if (!qSnap.exists) {
      throw new HttpsError('not-found', 'Qualificação não encontrada.');
    }
    const q = qSnap.data() as {
      insumoId: string;
      tipo: 'reagente' | 'controle';
      qualificacaoMode: 'corrida-validacao' | 'checklist-rt' | 'caracterizacao-rt';
      status?: string;
    };

    if (q.status === 'reprovado') {
      // Idempotência — já reprovado, no-op.
      return { ok: true, qId, insumoId: q.insumoId };
    }
    if (q.status === 'aprovado') {
      throw new HttpsError(
        'failed-precondition',
        'Qualificação já aprovada — não pode ser reprovada.',
      );
    }

    const insumoRef = db.doc(`labs/${labId}/insumos/${q.insumoId}`);
    const insumoSnap = await insumoRef.get();
    if (!insumoSnap.exists) {
      throw new HttpsError('not-found', 'Insumo não encontrado.');
    }
    const insumo = insumoSnap.data() as { tipo?: string };
    if (insumo.tipo === 'tira-uro') {
      throw new HttpsError('failed-precondition', 'tira-uro-not-supported-in-pr1');
    }
    if (q.qualificacaoMode === 'caracterizacao-rt') {
      throw new HttpsError(
        'failed-precondition',
        'caracterizacao-rt-not-supported-in-pr1',
      );
    }

    const op = await loadOperadorInfo(uid, role);
    const nowTs = admin.firestore.Timestamp.now();
    const movId = db.collection(`labs/${labId}/insumo-movimentacoes`).doc().id;
    const clientTimestamp = nowTs.toDate().toISOString();
    const payloadSignature = computeMovimentacaoQualificacaoSignature({
      movId,
      insumoId: q.insumoId,
      tipo: 'qualificacao',
      operadorId: uid,
      operadorName: op.nome,
      clientTimestamp,
      decision: 'reprovado',
      qualificacaoId: qId,
      motivoReprovacao,
    });

    const batch = db.batch();
    batch.update(qRef, {
      status: 'reprovado',
      motivoReprovacao,
      approvedBy: uid,
      approvedByNome: op.nome,
      approvedByCargo: op.cargo,
      approvedAt: nowTs,
      qcApprovalMethod: q.qualificacaoMode === 'checklist-rt' ? 'checklist-rt' : 'corrida-validacao',
      notivisaStatus: notificarNotivisa ? 'pendente' : 'dispensado',
    });
    batch.update(insumoRef, {
      qcStatus: 'reprovado',
      status: 'segregado',
      motivoReprovacao,
      qualificacaoId: qId,
      qcApprovedBy: uid,
      qcApprovedAt: nowTs,
      qcApprovalMethod: q.qualificacaoMode === 'checklist-rt' ? 'checklist-rt' : 'corrida-validacao',
    });
    batch.set(db.doc(`labs/${labId}/insumo-movimentacoes/${movId}`), {
      insumoId: q.insumoId,
      tipo: 'qualificacao',
      operadorId: uid,
      operadorName: op.nome,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      clientTimestamp,
      payloadSignature,
      chainHash: null,
      chainStatus: 'pending',
      decision: 'reprovado',
      qualificacaoId: qId,
      motivoReprovacao,
    });
    batch.set(db.doc(`labs/${labId}/ciq-audit/qual_${qId}`), {
      kind: 'insumo-qualificacao',
      qId,
      insumoId: q.insumoId,
      decision: 'reprovado',
      qualificacaoMode: q.qualificacaoMode,
      motivoReprovacao,
      approvedBy: uid,
      approvedByNome: op.nome,
      approvedByCargo: op.cargo,
      approvedAt: nowTs,
      copiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    db.collection('auditLogs')
      .add({
        action: 'INSUMO_QUALIFICACAO_REPROVADO',
        callerUid: uid,
        labId,
        targetId: q.insumoId,
        payload: { qId, motivoReprovacao, notificarNotivisa },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: true, qId, insumoId: q.insumoId };
  },
);
