/**
 * approveQualificacao — callable: aprova uma InsumoQualificacao.
 *
 * Sign-and-write atomic (Admin SDK bypassa rules):
 *   1. Auth gate + reauth window (10min) + role RT/biomedico (proxy: owner/admin).
 *   2. Gate de tipo: rejeita tira-uro (PR2) e caracterizacao-rt (PR2).
 *   3. Checklist 5 itens todos true.
 *   4. Se mode='corrida-validacao': >=1 evidenciaRunIds + cada run aponta
 *      pro insumo no slot correto (`reagente` / `controlePositivo` / `controleNegativo`).
 *   5. Transação atômica:
 *        a) InsumoQualificacao: status='aprovado', approvedBy/At/Cargo/Nome,
 *           qcApprovalMethod=qualificacaoMode.
 *        b) Insumo: qcStatus='aprovado', qualificacaoId, qcApprovedBy/At, qcApprovalMethod.
 *        c) Para cada runId: CIQImunoRun.qualificacaoId, usadaComoEvidencia=true.
 *           NÃO toca classificacaoImuno (imutável).
 *        d) InsumoMovimentacao tipo='qualificacao' { decision:'aprovado',
 *           qualificacaoId, payloadSignature, previousHash:null (selada pelo trigger
 *           onInsumoMovimentacaoCreate em ~1s).
 *        e) Cópia imutável em /labs/{lab}/ciq-audit/qual_{qId}.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

import {
  ApproveQualificacaoInputSchema,
  assertQualificacaoAccess,
  loadOperadorInfo,
} from './validators';
import {
  computeMovimentacaoQualificacaoSignature,
} from './signatureCanonical';

interface ApproveResult {
  ok: true;
  qId: string;
  insumoId: string;
}

export const approveQualificacao = onCall<unknown, Promise<ApproveResult>>(
  {},
  async (request) => {
    const parsed = ApproveQualificacaoInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, qId, evidenciaRunIds } = parsed.data;

    const { uid, role } = await assertQualificacaoAccess(request.auth, labId);
    const db = admin.firestore();

    // ── 1. Lê doc da qualificação (fonte da verdade) ──────────────────────
    const qRef = db.doc(`labs/${labId}/insumo-qualificacoes/${qId}`);
    const qSnap = await qRef.get();
    if (!qSnap.exists) {
      throw new HttpsError('not-found', 'Qualificação não encontrada.');
    }
    const q = qSnap.data() as {
      insumoId: string;
      tipo: 'reagente' | 'controle';
      nivel?: 'positivo' | 'negativo';
      qualificacaoMode: 'corrida-validacao' | 'checklist-rt' | 'caracterizacao-rt';
      checklistRecebimento?: Record<string, boolean>;
      status?: string;
    };

    if (q.status === 'aprovado') {
      // Idempotência — já aprovado, no-op.
      return { ok: true, qId, insumoId: q.insumoId };
    }
    if (q.status === 'reprovado') {
      throw new HttpsError(
        'failed-precondition',
        'Qualificação já reprovada — não pode ser aprovada.',
      );
    }

    // ── 2. Gate tipo ──────────────────────────────────────────────────────
    // Lê insumo para checar tipo='tira-uro' (PR2 não suportado).
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

    // ── 3. Checklist 5 itens ──────────────────────────────────────────────
    const cl = q.checklistRecebimento ?? {};
    const checklistKeys = [
      'embalagemIntegra',
      'prazoValidade',
      'condicoesTransporte',
      'dadosFabricante',
      'registroAnvisa',
    ];
    for (const k of checklistKeys) {
      if (cl[k] !== true) {
        throw new HttpsError(
          'failed-precondition',
          `Checklist incompleto: campo "${k}" precisa ser marcado.`,
        );
      }
    }

    // ── 4. Evidência analítica (modo dependente) ──────────────────────────
    if (q.qualificacaoMode === 'corrida-validacao') {
      if (!evidenciaRunIds || evidenciaRunIds.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'Modo corrida-validacao exige pelo menos 1 corrida como evidência.',
        );
      }
      // Slot mapping
      const slotEsperado: 'reagente' | 'controlePositivo' | 'controleNegativo' | null =
        q.tipo === 'reagente'
          ? 'reagente'
          : q.nivel === 'positivo'
            ? 'controlePositivo'
            : q.nivel === 'negativo'
              ? 'controleNegativo'
              : null;
      if (!slotEsperado) {
        throw new HttpsError('failed-precondition', 'invalid-tipo-nivel-combination');
      }

      // Cada run precisa ser collectionGroup-discoverable. Em Imuno o path é
      // /labs/{lab}/ciq-imuno/{lotId}/runs/{runId}. Buscamos via collectionGroup.
      const runsCheck = await Promise.all(
        evidenciaRunIds.map(async (runId) => {
          const cg = await db
            .collectionGroup('runs')
            .where('id', '==', runId)
            .limit(1)
            .get();
          if (!cg.empty) return { runId, ref: cg.docs[0].ref, data: cg.docs[0].data() };
          // Fallback: query by document ID — Firestore não permite where on docId
          // em collectionGroup sem o predicate FieldPath.documentId(). Tenta direto.
          const cg2 = await db
            .collectionGroup('runs')
            .where(admin.firestore.FieldPath.documentId(), '>=', runId)
            .where(admin.firestore.FieldPath.documentId(), '<=', runId + '')
            .limit(1)
            .get();
          if (cg2.empty) return null;
          return { runId, ref: cg2.docs[0].ref, data: cg2.docs[0].data() };
        }),
      );

      const runRefs: admin.firestore.DocumentReference[] = [];
      for (const r of runsCheck) {
        if (!r) {
          throw new HttpsError('not-found', 'run-not-found');
        }
        const snap = r.data as Record<string, unknown>;
        const ins = (snap['insumosSnapshot'] ?? {}) as Record<
          string,
          { id?: string } | undefined
        >;
        const slotInsumoId = ins[slotEsperado]?.id;
        if (slotInsumoId !== q.insumoId) {
          throw new HttpsError(
            'failed-precondition',
            `run-slot-mismatch: run ${r.runId} não usou este insumo no slot ${slotEsperado}.`,
          );
        }
        runRefs.push(r.ref);
      }

      // Carrega operador
      const op = await loadOperadorInfo(uid, role);

      // ── 5. Transação atômica ────────────────────────────────────────────
      const nowTs = admin.firestore.Timestamp.now();
      const movId = db
        .collection(`labs/${labId}/insumo-movimentacoes`)
        .doc().id;
      const clientTimestamp = nowTs.toDate().toISOString();
      const payloadSignature = computeMovimentacaoQualificacaoSignature({
        movId,
        insumoId: q.insumoId,
        tipo: 'qualificacao',
        operadorId: uid,
        operadorName: op.nome,
        clientTimestamp,
        decision: 'aprovado',
        qualificacaoId: qId,
      });

      const batch = db.batch();
      batch.update(qRef, {
        status: 'aprovado',
        approvedBy: uid,
        approvedByNome: op.nome,
        approvedByCargo: op.cargo,
        approvedAt: nowTs,
        qcApprovalMethod: q.qualificacaoMode,
      });
      batch.update(insumoRef, {
        qcStatus: 'aprovado',
        qualificacaoId: qId,
        qcApprovedBy: uid,
        qcApprovedAt: nowTs,
        qcApprovalMethod: q.qualificacaoMode,
      });
      for (const ref of runRefs) {
        batch.update(ref, {
          qualificacaoId: qId,
          usadaComoEvidencia: true,
        });
      }
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
        decision: 'aprovado',
        qualificacaoId: qId,
        qcApprovedBy: uid,
      });
      // Cópia imutável em ciq-audit
      batch.set(db.doc(`labs/${labId}/ciq-audit/qual_${qId}`), {
        kind: 'insumo-qualificacao',
        qId,
        insumoId: q.insumoId,
        decision: 'aprovado',
        qualificacaoMode: q.qualificacaoMode,
        evidenciaRunIds: [...evidenciaRunIds].sort(),
        approvedBy: uid,
        approvedByNome: op.nome,
        approvedByCargo: op.cargo,
        approvedAt: nowTs,
        copiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // Audit log
      db.collection('auditLogs')
        .add({
          action: 'INSUMO_QUALIFICACAO_APROVADO',
          callerUid: uid,
          labId,
          targetId: q.insumoId,
          payload: { qId, mode: q.qualificacaoMode, runs: evidenciaRunIds.length },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      return { ok: true, qId, insumoId: q.insumoId };
    }

    // ── checklist-rt path (sem evidência analítica) ──────────────────────
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
      decision: 'aprovado',
      qualificacaoId: qId,
    });

    const batch = db.batch();
    batch.update(qRef, {
      status: 'aprovado',
      approvedBy: uid,
      approvedByNome: op.nome,
      approvedByCargo: op.cargo,
      approvedAt: nowTs,
      qcApprovalMethod: 'checklist-rt',
    });
    batch.update(insumoRef, {
      qcStatus: 'aprovado',
      qualificacaoId: qId,
      qcApprovedBy: uid,
      qcApprovedAt: nowTs,
      qcApprovalMethod: 'checklist-rt',
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
      decision: 'aprovado',
      qualificacaoId: qId,
      qcApprovedBy: uid,
    });
    batch.set(db.doc(`labs/${labId}/ciq-audit/qual_${qId}`), {
      kind: 'insumo-qualificacao',
      qId,
      insumoId: q.insumoId,
      decision: 'aprovado',
      qualificacaoMode: 'checklist-rt',
      evidenciaRunIds: [],
      approvedBy: uid,
      approvedByNome: op.nome,
      approvedByCargo: op.cargo,
      approvedAt: nowTs,
      copiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    db.collection('auditLogs')
      .add({
        action: 'INSUMO_QUALIFICACAO_APROVADO',
        callerUid: uid,
        labId,
        targetId: q.insumoId,
        payload: { qId, mode: 'checklist-rt' },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    return { ok: true, qId, insumoId: q.insumoId };
  },
);
