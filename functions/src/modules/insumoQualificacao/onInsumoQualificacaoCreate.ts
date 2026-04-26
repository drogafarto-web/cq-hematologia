/**
 * onInsumoQualificacaoCreate — trigger onCreate em
 * /labs/{labId}/insumo-qualificacoes/{qId}.
 *
 * Re-calcula `logicalSignature` server-side a partir do payload canônico
 * gravado pelo cliente. Fluxo:
 *   1. Recalcula assinatura.
 *   2. Diverge → doc.signatureStatus='invalid' + cria alerta em /alertas/.
 *   3. Bate     → doc.signatureStatus='valid'.
 *   4. Em ambos os casos: cópia imutável em /labs/{lab}/ciq-audit/qual_{qId}
 *      preservando o estado pós-trigger.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

import { computeQualificacaoSignature } from './signatureCanonical';

export const onInsumoQualificacaoCreate = onDocumentCreated(
  {
    document: 'labs/{labId}/insumo-qualificacoes/{qId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const labId = event.params.labId;
    const qId = event.params.qId;
    const data = snap.data() as Record<string, unknown>;
    const db = admin.firestore();

    const expected = (data['logicalSignature'] ?? '') as string;
    const checklist = (data['checklistRecebimento'] ?? {}) as Record<string, boolean>;
    const evidenciaRunIds = Array.isArray(data['evidenciaRunIds'])
      ? (data['evidenciaRunIds'] as string[])
      : [];
    const clientCreatedAt = String(data['clientCreatedAt'] ?? '');
    const createdBy = String(data['createdBy'] ?? '');

    let recomputed = '';
    let status: 'valid' | 'invalid' = 'invalid';
    try {
      recomputed = computeQualificacaoSignature({
        qId,
        insumoId: String(data['insumoId'] ?? ''),
        produtoId: String(data['produtoId'] ?? ''),
        tipo: data['tipo'] as 'reagente' | 'controle',
        nivel: data['nivel'] as 'positivo' | 'negativo' | undefined,
        modulo: String(data['modulo'] ?? ''),
        qualificacaoMode: data['qualificacaoMode'] as
          | 'corrida-validacao'
          | 'checklist-rt'
          | 'caracterizacao-rt',
        checklist: JSON.stringify(checklist),
        evidenciaRunIds,
        createdBy,
        clientCreatedAt,
      });
      status = recomputed === expected ? 'valid' : 'invalid';
    } catch (err) {
      console.error('[onInsumoQualificacaoCreate] hash error', err);
      status = 'invalid';
    }

    try {
      await snap.ref.update({ signatureStatus: status });
    } catch (err) {
      console.error('[onInsumoQualificacaoCreate] failed to update signatureStatus', err);
    }

    if (status === 'invalid') {
      try {
        await db.collection(`labs/${labId}/alertas`).add({
          type: 'signature_invalid',
          severity: 'error',
          relatedDocPath: `labs/${labId}/insumo-qualificacoes/${qId}`,
          relatedDocId: qId,
          message:
            'Assinatura lógica de qualificação inválida. Verifique se o cliente foi adulterado.',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error('[onInsumoQualificacaoCreate] failed to create alerta', err);
      }
    }

    // Cópia imutável em ciq-audit (estado pós-trigger).
    try {
      await db.doc(`labs/${labId}/ciq-audit/qual_${qId}`).set(
        {
          kind: 'insumo-qualificacao-create',
          qId,
          insumoId: data['insumoId'],
          signatureStatus: status,
          recomputed,
          expected,
          copiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error('[onInsumoQualificacaoCreate] failed to write ciq-audit copy', err);
    }
  },
);
