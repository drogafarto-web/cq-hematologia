import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * aggregateKPIs — Scheduled daily aggregation (00:00 UTC) of quality metrics.
 * Computes turnaround, rework%, conformance%, NC origins, SLA compliance.
 */
export const aggregateKPIs = onSchedule(
  {
    schedule: 'every day 0:00', // Daily at 00:00 UTC
    region: 'southamerica-east1',
    timeoutSeconds: 300,
  },
  async () => {
    const labsSnapshot = await db.collection('labs').get();

    for (const labDoc of labsSnapshot.docs) {
      const labId = labDoc.id;

      try {
        // Read lab config for SLA threshold
        const labConfigSnap = await db.doc(`labs/${labId}/config/settings`).get();
        const slaLimitHoras = labConfigSnap.exists ? labConfigSnap.data()?.slaLimitHoras || 24 : 24;

        // Get runs from last 24h
        const now = admin.firestore.Timestamp.now();
        const yesterday = new Date(now.toDate().getTime() - 24 * 60 * 60 * 1000);
        const yesterdayTs = admin.firestore.Timestamp.fromDate(yesterday);

        const runsSnapshot = await db
          .collectionGroup('runs')
          .where('labId', '==', labId)
          .where('criadoEm', '>=', yesterdayTs)
          .get();

        if (runsSnapshot.empty) {
          console.log(`[KPI] Lab ${labId}: No runs in last 24h, skipping aggregation`);
          continue;
        }

        // Aggregate metrics
        const runs = runsSnapshot.docs.map(d => d.data());
        const totalRuns = runs.length;

        // TURNAROUND: avg time from creation to result release
        const turnaroundTimes: number[] = [];
        let turnaroundSum = 0;

        for (const run of runs) {
          if (run.resultadoLiberadoEm && run.criadoEm) {
            const liberadoMs = run.resultadoLiberadoEm.toDate().getTime();
            const criadoMs = run.criadoEm.toDate().getTime();
            const diffHoras = (liberadoMs - criadoMs) / (1000 * 60 * 60);
            turnaroundTimes.push(diffHoras);
            turnaroundSum += diffHoras;
          }
        }

        const turnaroundMedia = turnaroundTimes.length > 0 ? turnaroundSum / turnaroundTimes.length : 0;
        turnaroundTimes.sort((a, b) => a - b);
        const turnaroundP95 = turnaroundTimes[Math.ceil(turnaroundTimes.length * 0.95) - 1] || 0;

        // REWORK: repeat runs (same sample, same equipment, within 24h)
        const runsPerSample: Record<string, number> = {};
        let reruns = 0;

        for (const run of runs) {
          const sampleKey = `${run.amostraId || 'unknown'}`;
          runsPerSample[sampleKey] = (runsPerSample[sampleKey] || 0) + 1;
        }

        for (const count of Object.values(runsPerSample)) {
          if (count > 1) reruns += count - 1;
        }

        const retrabalhoPercentual = totalRuns > 0 ? (reruns / totalRuns) * 100 : 0;

        // CONFORMANCE: runs with popId + equipId + operadorId
        let runsConformes = 0;
        for (const run of runs) {
          if (run.popId && run.equipId && run.operadorId) {
            runsConformes += 1;
          }
        }
        const conformancePercentual = totalRuns > 0 ? (runsConformes / totalRuns) * 100 : 0;

        // NC ORIGINS: count by module
        const ncSnapshot = await db
          .collectionGroup('nao-conformidades')
          .where('labId', '==', labId)
          .where('criadoEm', '>=', yesterdayTs)
          .where('deletadoEm', '==', null)
          .get();

        const ncPorOrigem: Record<string, number> = {};
        let ncAbertasTotal = 0;

        for (const ncDoc of ncSnapshot.docs) {
          const ncData = ncDoc.data();
          const modulo = ncData.modulo || 'unknown';
          ncPorOrigem[modulo] = (ncPorOrigem[modulo] || 0) + 1;
          ncAbertasTotal += 1;
        }

        // SLA COMPLIANCE: check if turnaround exceeds limit
        const slaAtendido = turnaroundMedia <= slaLimitHoras;

        // Alert if SLA breached
        if (!slaAtendido) {
          const alertRef = db.collection(`labs/${labId}/kpi-alerts`).doc();
          await alertRef.set({
            labId,
            tipo: 'sla_breach',
            severidade: 'critical',
            mensagem: `Turnaround médio (${turnaroundMedia.toFixed(1)}h) excedeu limite de ${slaLimitHoras}h`,
            acionada_em: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // High rework alert
        if (retrabalhoPercentual > 10) {
          const alertRef = db.collection(`labs/${labId}/kpi-alerts`).doc();
          await alertRef.set({
            labId,
            tipo: 'high_rework',
            severidade: retrabalhoPercentual > 20 ? 'critical' : 'warning',
            mensagem: `Retrabalho em ${retrabalhoPercentual.toFixed(1)}% das corridas`,
            acionada_em: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Low conformance alert
        if (conformancePercentual < 95) {
          const alertRef = db.collection(`labs/${labId}/kpi-alerts`).doc();
          await alertRef.set({
            labId,
            tipo: 'low_conformance',
            severidade: conformancePercentual < 90 ? 'critical' : 'warning',
            mensagem: `Conformidade em ${conformancePercentual.toFixed(1)}% (meta: 95%+)`,
            acionada_em: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Store KPI daily record
        const kpiRecord = {
          labId,
          data: admin.firestore.Timestamp.fromDate(new Date()),
          turnaround_media_horas: turnaroundMedia,
          turnaround_percentil_95: turnaroundP95,
          retrabalho_percentual: retrabalhoPercentual,
          retrabalho_total: reruns,
          conformidade_percentual: conformancePercentual,
          runs_total: totalRuns,
          runs_conformes: runsConformes,
          nc_total_abertas: ncAbertasTotal,
          nc_por_origem: ncPorOrigem,
          sla_atendido: slaAtendido,
          sla_limite_horas: slaLimitHoras,
          criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection(`labs/${labId}/kpi-metrics`).add(kpiRecord);

        console.log(`[KPI] Lab ${labId}: Aggregation complete (runs: ${totalRuns}, turnaround: ${turnaroundMedia.toFixed(1)}h)`);

        // Audit
        db.collection('auditLogs')
          .add({
            action: 'KPI_AGREGADO',
            labId,
            payload: {
              runs: totalRuns,
              turnaround: turnaroundMedia.toFixed(1),
              retrabalho: retrabalhoPercentual.toFixed(1),
              conformance: conformancePercentual.toFixed(1),
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      } catch (error) {
        console.error(`Erro agregando KPIs para ${labId}:`, error);
      }
    }
  }
);
