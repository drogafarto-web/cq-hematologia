/**
 * risks_alertRiskReviews — scheduled (07:00 America/Sao_Paulo).
 *
 * Varre riscos ativos em `labs/{labId}/risks` e gera/atualiza KPI alerts em
 * `labs/{labId}/kpi-alerts` quando a próxima revisão cai dentro de 7 dias
 * (ou já venceu). Usa `reviewSchedule.proximaRevisao` quando presente;
 * caso contrário `reviewDate` (paridade com dados atuais).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const REGION = 'southamerica-east1';
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;
const ALERT_TIPO = 'revisao_risco_vencida' as const;

/** Spec: aberto ou em_tratamento; domínio atual inclui mitigando. */
const OPEN_STATUSES = ['aberto', 'mitigando', 'em_tratamento'] as const;

function getProximaRevisaoTs(
  data: FirebaseFirestore.DocumentData,
): admin.firestore.Timestamp | null {
  const rs = data['reviewSchedule'] as { proximaRevisao?: unknown } | undefined;
  const pr = rs?.proximaRevisao;
  if (pr instanceof admin.firestore.Timestamp) return pr;
  const rd = data['reviewDate'];
  if (rd instanceof admin.firestore.Timestamp) return rd;
  return null;
}

async function upsertKpiAlert(
  db: admin.firestore.Firestore,
  labId: string,
  docId: string,
  severidade: 'warning' | 'critical',
  mensagem: string,
): Promise<void> {
  const ref = db.doc(`labs/${labId}/kpi-alerts/${docId}`);
  const snap = await ref.get();
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const base = {
    labId,
    tipo: ALERT_TIPO,
    severidade,
    mensagem,
    acionada_em: ts,
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

export const risks_alertRiskReviews = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const thresholdMs = now.toMillis() + WINDOW_DAYS * DAY_MS;
    let labsProcessed = 0;
    let alertsWritten = 0;

    const labsSnap = await db.collection('labs').get();

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;
      labsProcessed += 1;

      const risksSnap = await db
        .collection(`labs/${labId}/risks`)
        .where('deletadoEm', '==', null)
        .where('status', 'in', [...OPEN_STATUSES])
        .get();

      for (const riskDoc of risksSnap.docs) {
        const data = riskDoc.data();
        const prox = getProximaRevisaoTs(data);
        if (prox == null) continue;

        if (prox.toMillis() >= thresholdMs) continue;

        const codigo = (data['codigo'] as string | undefined) ?? riskDoc.id;
        const overdue = prox.toMillis() < now.toMillis();

        if (overdue) {
          logger.warn('risk_review_overdue', {
            labId,
            riskId: riskDoc.id,
            codigo,
            proximaRevisao: prox.toDate().toISOString(),
          });
        }

        const severidade: 'warning' | 'critical' = overdue ? 'critical' : 'warning';
        const mensagem = overdue
          ? `Revisão de risco «${codigo}» vencida (${prox.toDate().toLocaleDateString('pt-BR')}).`
          : `Revisão de risco «${codigo}» prevista em ${prox.toDate().toLocaleDateString('pt-BR')} (≤ ${WINDOW_DAYS} dias).`;

        await upsertKpiAlert(
          db,
          labId,
          `risk_review_${riskDoc.id}`,
          severidade,
          mensagem,
        );
        alertsWritten += 1;
      }
    }

    logger.info('risks_alertRiskReviews_done', {
      labsProcessed,
      alertsWritten,
    });
  },
);
