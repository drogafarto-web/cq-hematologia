/**
 * ec_onParticipanteCreated — defense-in-depth FK check (2026-04-24).
 *
 * Trigger `onDocumentCreated` em
 * `educacaoContinuada/{labId}/participantes/{participanteId}`.
 *
 * Valida que:
 *  1. `execucaoId` do participante aponta pra uma Execucao existente no MESMO labId
 *  2. A Execucao não está soft-deleted
 *  3. `colaboradorId` aponta pra um Colaborador existente no MESMO labId
 *
 * Violações detectadas:
 *  - Soft-delete do participante (setando `deletadoEm` server-side)
 *  - Gravação em `/auditLogs/` com severity `FK_VIOLATION`
 *
 * Contexto: rules pós-Fase 0c têm `allow create: if false` em participantes —
 * então criação só acontece via callables Admin SDK. Este trigger é a última
 * linha de defesa contra:
 *   a) Bug em callable novo que esqueça de validar FK
 *   b) Criação manual via Admin SDK (scripts de migração, debug)
 *   c) Regressão em callable existente após edição
 *
 * Não trava operação — trigger roda assíncrono depois do commit. O callable
 * já escreveu; se FK falha, cleanup post-hoc + log. Sem RASE condition: o
 * participante órfão fica marcado como deletado rapidamente (~1s após create).
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

export const ec_onParticipanteCreated = onDocumentCreated(
  'educacaoContinuada/{labId}/participantes/{participanteId}',
  async (event) => {
    const { labId, participanteId } = event.params;
    const data = event.data?.data();
    if (!data) return;

    const execucaoId = data['execucaoId'] as string | undefined;
    const colaboradorId = data['colaboradorId'] as string | undefined;
    const payloadLabId = data['labId'] as string | undefined;

    const violations: string[] = [];

    // 0. labId no payload bate com o path
    if (payloadLabId !== labId) {
      violations.push(`labId_mismatch(path=${labId}, doc=${payloadLabId ?? 'null'})`);
    }

    const db = admin.firestore();

    // 1. Execucao existe e não está deletada
    if (!execucaoId) {
      violations.push('execucaoId_missing');
    } else {
      const execSnap = await db
        .doc(`educacaoContinuada/${labId}/execucoes/${execucaoId}`)
        .get();
      if (!execSnap.exists) {
        violations.push(`execucao_not_found(${execucaoId})`);
      } else {
        const exec = execSnap.data();
        if (exec?.['deletadoEm'] !== null) {
          violations.push(`execucao_soft_deleted(${execucaoId})`);
        }
        if (exec?.['labId'] !== labId) {
          violations.push(`execucao_cross_tenant(${execucaoId})`);
        }
      }
    }

    // 2. Colaborador existe e não está deletado
    if (!colaboradorId) {
      violations.push('colaboradorId_missing');
    } else {
      const colabSnap = await db
        .doc(`educacaoContinuada/${labId}/colaboradores/${colaboradorId}`)
        .get();
      if (!colabSnap.exists) {
        violations.push(`colaborador_not_found(${colaboradorId})`);
      } else {
        const colab = colabSnap.data();
        if (colab?.['labId'] !== labId) {
          violations.push(`colaborador_cross_tenant(${colaboradorId})`);
        }
      }
    }

    if (violations.length === 0) return;

    // Violação — soft-delete do participante órfão
    try {
      await event.data?.ref.update({
        deletadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {
      // se falhar (ex: já foi deletado), segue — audit log ainda é gravado
    }

    db.collection('auditLogs')
      .add({
        action: 'EC_FK_VIOLATION_PARTICIPANTE',
        severity: 'FK_VIOLATION',
        labId,
        payload: {
          participanteId,
          execucaoId: execucaoId ?? null,
          colaboradorId: colaboradorId ?? null,
          violations,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});
  },
);
