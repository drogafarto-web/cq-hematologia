/**
 * equipamentos_alertManutencaoVencida — scheduled (every 24 hours, southamerica-east1).
 *
 * Para cada lab/equipamento, lê `manutencoes` com `status === 'agendada'`, filtra
 * `dataPrevista` anterior a now − 1 dia e upsert em `labs/{labId}/kpi-alerts`.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const REGION = 'southamerica-east1';
const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_TIPO = 'manutencao_vencida' as const;

function getDataPrevistaMillis(data: FirebaseFirestore.DocumentData): number | null {
  const dp = data['dataPrevista'];
  if (dp instanceof admin.firestore.Timestamp) return dp.toMillis();
  return null;
}

async function upsertKpiAlert(
  db: admin.firestore.Firestore,
  labId: string,
  docId: string,
  payload: {
    equipamentoId: string;
    manutencaoId: string;
    mensagem: string;
  },
): Promise<void> {
  const ref = db.doc(`labs/${labId}/kpi-alerts/${docId}`);
  const snap = await ref.get();
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const base = {
    labId,
    tipo: ALERT_TIPO,
    severidade: 'critical' as const,
    equipamentoId: payload.equipamentoId,
    manutencaoId: payload.manutencaoId,
    mensagem: payload.mensagem,
    acionada_em: ts,
    resolvido: false,
  };
  if (!snap.exists) {
    await ref.set({
      ...base,
      lida: false,
      criadoEm: ts,
    });
  } else {
    await ref.set(base, { merge: true });
  }
}

export const equipamentos_alertManutencaoVencida = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const nowMs = Date.now();
    const thresholdMs = nowMs - DAY_MS;
    let labsProcessed = 0;
    let equipamentosScanned = 0;
    let candidates = 0;
    let alertsWritten = 0;

    const labsSnap = await db.collection('labs').get();

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;
      labsProcessed += 1;

      const equipSnap = await db.collection(`labs/${labId}/equipamentos`).get();

      for (const equipDoc of equipSnap.docs) {
        equipamentosScanned += 1;
        const equipamentoId = equipDoc.id;

        const manSnap = await db
          .collection(`labs/${labId}/equipamentos/${equipamentoId}/manutencoes`)
          .where('status', '==', 'agendada')
          .get();

        for (const doc of manSnap.docs) {
          const data = doc.data();
          const dpMs = getDataPrevistaMillis(data);
          if (dpMs == null || dpMs >= thresholdMs) continue;

          candidates += 1;
          const tipo = (data['tipo'] as string | undefined) ?? 'preventiva';
          const manutencaoId = doc.id;
          const mensagem = `Manutenção ${tipo} vencida para equipamento ${equipamentoId}`;

          await upsertKpiAlert(db, labId, `manutencao_vencida_${manutencaoId}`, {
            equipamentoId,
            manutencaoId,
            mensagem,
          });
          alertsWritten += 1;
        }
      }
    }

    logger.info('equipamentos_alertManutencaoVencida_done', {
      labsProcessed,
      equipamentosScanned,
      candidates,
      alertsWritten,
    });
  },
);
