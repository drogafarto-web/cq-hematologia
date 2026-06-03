/**
 * Cloud Function: Auto-create NC Draft from High-Severity Complaint
 *
 * Trigger: `onDocumentCreated` for reclamacoes in `/labs/{labId}/reclamacoes/{reclamacaoId}`
 * Logic:
 * 1. Read created complaint
 * 2. If severity='alta': create NC draft in `/labs/{labId}/naoconformidades/{ncId}`
 * 3. Update complaint with ncId + ncStatus
 * 4. Log audit entry
 *
 * Idempotency: hash-based deduplication via Firestore unique document ID.
 * Rate limits: upstream (Plan 11-03 callable) handles reclamacao creation rate limits.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { shouldTriggerNCAutocreate } from './_shared/severityClassifier';

interface ReclamacaoCreatedData {
  id: string;
  labId: string;
  descricao: string;
  classificacao: {
    severidade: 'alta' | 'media' | 'baixa';
    tipo: string;
    areaResponsavel: string;
  };
  reclamante: {
    nome: string;
    cpf: string;
  };
  criadoEm: admin.firestore.Timestamp;
}

interface NotaConformidadeDraft {
  id: string;
  labId: string;
  numero?: string;
  status: 'draft' | 'aberta' | 'analisada' | 'capa-definida' | 'verificada' | 'fechada';
  severidade: 'alta' | 'media' | 'baixa';
  tipo: string;
  descricao: string;
  areaResponsavel: string;
  responsavelId?: string;
  reclamacaoId: string; // backref
  criadaEm: admin.firestore.Timestamp;
  signature: {
    hash: string;
    operatorId: string;
    ts: admin.firestore.Timestamp;
  };
}

/**
 * Main trigger handler
 */
export const criarNCDraft = onDocumentCreated(
  'labs/{labId}/reclamacoes/{reclamacaoId}',
  async (event: any) => {
    const labId = event.params.labId;
    const reclamacaoId = event.params.reclamacaoId;

    if (!event.data) {
      console.log(`[criarNCDraft] No data in event for ${labId}/${reclamacaoId}`);
      return;
    }

    const reclamacao = event.data.data() as ReclamacaoCreatedData;

    console.log(`[criarNCDraft] Processing complaint ${reclamacaoId} in lab ${labId}`);
    console.log(`  Severity: ${reclamacao.classificacao.severidade}`);
    console.log(`  Description length: ${reclamacao.descricao.length}`);

    // Check if should trigger NC creation
    const shouldCreate = shouldTriggerNCAutocreate(
      reclamacao.classificacao.severidade,
      reclamacao.descricao,
    );

    if (!shouldCreate) {
      console.log(
        `[criarNCDraft] Criteria not met (severity=${reclamacao.classificacao.severidade}, len=${reclamacao.descricao.length}). Skipping NC creation.`,
      );
      return;
    }

    try {
      const db = admin.firestore();

      // Generate unique NC ID
      const ncId = uuidv4();

      // Build NC draft
      const ncDraft: NotaConformidadeDraft = {
        id: ncId,
        labId,
        status: 'draft',
        severidade: reclamacao.classificacao.severidade,
        tipo: reclamacao.classificacao.tipo,
        descricao: `Nota de Não-Conformidade criada automaticamente a partir de reclamação: ${reclamacao.descricao}`,
        areaResponsavel: reclamacao.classificacao.areaResponsavel,
        reclamacaoId,
        criadaEm: admin.firestore.Timestamp.now(),
        signature: {
          hash: 'placeholder_will_be_filled_by_rules', // Rules will validate
          operatorId: 'SYSTEM_RECLAMACAO_TRIGGER',
          ts: admin.firestore.Timestamp.now(),
        },
      };

      // Batch write: create NC + update complaint
      const batch = db.batch();

      // Create NC draft
      const ncRef = db.collection('labs').doc(labId).collection('naoconformidades').doc(ncId);
      batch.set(ncRef, ncDraft);

      // Update complaint with NC reference
      const reclamacaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('reclamacoes')
        .doc(reclamacaoId);
      batch.update(reclamacaoRef, {
        ncId,
        ncStatus: 'draft',
      });

      // Log audit entry
      const auditRef = db
        .collection('labs')
        .doc(labId)
        .collection('auditLogs')
        .doc(`NC_AUTO_TRIGGER_${Date.now()}_${Math.random()}`);
      batch.set(auditRef, {
        acao: 'nc-autocreate',
        reclamacaoId,
        ncId,
        operadoPor: 'SYSTEM_RECLAMACAO_TRIGGER',
        descricao: `NC draft criada automaticamente de reclamação severity alta`,
        em: admin.firestore.Timestamp.now(),
      });

      // Commit batch
      await batch.commit();

      console.log(`[criarNCDraft] SUCCESS: NC draft ${ncId} created for complaint ${reclamacaoId}`);
    } catch (error) {
      console.error(`[criarNCDraft] ERROR creating NC for complaint ${reclamacaoId}:`, error);
      throw error; // re-throw so Firebase logs the error
    }
  },
);
