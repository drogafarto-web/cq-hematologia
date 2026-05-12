/**
 * apoio_alertVencimentos — scheduled (07:00 America/Sao_Paulo).
 *
 * Varre contratos ativos em `labs/{labId}/lab-apoio` e gera/atualiza KPI alerts
 * em `labs/{labId}/kpi-alerts` para vigência de contrato e validade de
 * certificações dentro de 30 dias (ou já vencidos).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const REGION = 'southamerica-east1';
const DAY_MS = 24 * 60 * 60 * 1000;
const ALERT_TIPO = 'vencimento_contrato_apoio' as const;

function todayIsoUtcDate(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetweenEndAndToday(endIso: string, nowIso: string): number {
  return Math.floor(
    (new Date(endIso).getTime() - new Date(nowIso).getTime()) / DAY_MS,
  );
}

function timestampToDateIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString().split('T')[0];
  }
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

export const apoio_alertVencimentos = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: REGION,
    memory: '512MiB',
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const nowIso = todayIsoUtcDate();
    let labsProcessed = 0;
    let alertsWritten = 0;

    const labsSnap = await db.collection('labs').get();

    for (const labDoc of labsSnap.docs) {
      const labId = labDoc.id;
      labsProcessed += 1;

      const contratosSnap = await db
        .collection(`labs/${labId}/lab-apoio`)
        .where('ativo', '==', true)
        .where('deletadoEm', '==', null)
        .get();

      for (const contratoDoc of contratosSnap.docs) {
        const contrato = contratoDoc.data();
        const nome = (contrato['nome'] as string | undefined) ?? contratoDoc.id;
        const vigenciaFim = contrato['vigenciaFim'] as string | undefined;
        if (typeof vigenciaFim === 'string' && vigenciaFim.length > 0) {
          const daysVig = daysBetweenEndAndToday(vigenciaFim, nowIso);
          if (daysVig <= 30) {
            const severidade: 'warning' | 'critical' =
              daysVig < 0 ? 'critical' : 'warning';
            const mensagem =
              daysVig < 0
                ? `Contrato de apoio «${nome}»: vigência vencida em ${vigenciaFim}.`
                : `Contrato de apoio «${nome}»: vigência encerra em ${vigenciaFim} (${daysVig === 0 ? 'hoje' : `em ${daysVig} dia(s)`}).`;
            await upsertKpiAlert(
              db,
              labId,
              `vig_apoio_${contratoDoc.id}`,
              severidade,
              mensagem,
            );
            alertsWritten += 1;
          }
        }

        const certs = (contrato['certificacoes'] as unknown[] | undefined) ?? [];
        for (let ci = 0; ci < certs.length; ci += 1) {
          const raw = certs[ci];
          if (typeof raw !== 'object' || raw === null) continue;
          const cert = raw as Record<string, unknown>;
          if (cert['ativo'] !== true) continue;
          const certId = typeof cert['id'] === 'string' ? cert['id'] : '';
          const certNome =
            typeof cert['nome'] === 'string' ? cert['nome'] : 'Certificação';
          const certIso = timestampToDateIso(cert['dataValidade']);
          if (certIso === null) continue;
          const daysCert = daysBetweenEndAndToday(certIso, nowIso);
          if (daysCert <= 30) {
            const severidade: 'warning' | 'critical' =
              daysCert < 0 ? 'critical' : 'warning';
            const mensagem =
              daysCert < 0
                ? `Certificação «${certNome}» (${nome}): validade vencida em ${certIso}.`
                : `Certificação «${certNome}» (${nome}): validade até ${certIso} (${daysCert === 0 ? 'hoje' : `em ${daysCert} dia(s)`}).`;
            const suffix = certId.length > 0 ? certId : String(ci);
            await upsertKpiAlert(
              db,
              labId,
              `cert_apoio_${contratoDoc.id}_${suffix}`,
              severidade,
              mensagem,
            );
            alertsWritten += 1;
          }
        }
      }
    }

    logger.info('[apoio_alertVencimentos] completed', {
      labsProcessed,
      alertsWritten,
    });
  },
);
