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

        // KPI-FIX-1: exclude soft-deleted runs from all calculations
        const runsSnapshot = await db
          .collectionGroup('runs')
          .where('labId', '==', labId)
          .where('criadoEm', '>=', yesterdayTs)
          .where('deletadoEm', '==', null)
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

        // KPI-FIX-3: use explicit rerun flag instead of amostraId duplication inference.
        // Schema check: prefer run.rerun === true or run.statusRun === 'repetido'.
        // Fallback: count amostraId duplicates only for non-null/non-unknown amostraIds to
        // reduce false positives — but this is a best-effort approximation.
        // TODO(GAP-rerun): add explicit `rerun: boolean` field to Run schema so this is exact.
        let reruns = 0;

        const hasExplicitRerunField = runs.some(
          r => r.rerun !== undefined || r.statusRun !== undefined,
        );

        if (hasExplicitRerunField) {
          reruns = runs.filter(
            r => r.rerun === true || r.statusRun === 'repetido',
          ).length;
        } else {
          // Fallback: amostraId-based heuristic — exclude null/'unknown' to avoid over-counting
          const validRuns = runs.filter(
            r => r.amostraId && r.amostraId !== 'unknown',
          );
          const runsPerSample: Record<string, number> = {};
          for (const run of validRuns) {
            const key = run.amostraId as string;
            runsPerSample[key] = (runsPerSample[key] || 0) + 1;
          }
          for (const count of Object.values(runsPerSample)) {
            if (count > 1) reruns += count - 1;
          }
        }

        const retrabalhoPercentual = totalRuns > 0 ? (reruns / totalRuns) * 100 : 0;

        // KPI-FIX-4: renamed to documentacao_percentual — measures documentation completeness
        // (popId + equipId + operadorId preenchidos), NOT conformidade CIQ (Levey-Jennings/Westgard).
        // GAP-TODO-conformidade-ciq: implement true CIQ conformance via Westgard rules on chart module.
        let runsDocumentados = 0;
        for (const run of runs) {
          if (run.popId && run.equipId && run.operadorId) {
            runsDocumentados += 1;
          }
        }
        // documentacao_percentual: % of runs with popId + equipId + operadorId filled in
        const documentacaoPercentual = totalRuns > 0 ? (runsDocumentados / totalRuns) * 100 : 0;

        // KPI-FIX-2: nc_total_abertas = NCs with status 'aberta' (cumulative open),
        // NOT NCs created in the last 24h. Removed criadoEm >= yesterdayTs filter.
        const ncAbertas = await db
          .collectionGroup('nao-conformidades')
          .where('labId', '==', labId)
          .where('status', '==', 'aberta')
          .where('deletadoEm', '==', null)
          .get();

        const ncPorOrigem: Record<string, number> = {};
        let ncAbertasTotal = 0;

        for (const ncDoc of ncAbertas.docs) {
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

        // Low documentation alert (KPI-FIX-4: was 'low_conformance' / conformidade_percentual)
        if (documentacaoPercentual < 95) {
          const alertRef = db.collection(`labs/${labId}/kpi-alerts`).doc();
          await alertRef.set({
            labId,
            tipo: 'low_conformance',
            severidade: documentacaoPercentual < 90 ? 'critical' : 'warning',
            mensagem: `Documentação de corridas em ${documentacaoPercentual.toFixed(1)}% (meta: 95%+)`,
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
          // KPI-FIX-4: renamed from conformidade_percentual — see type KPIDaily
          documentacao_percentual: documentacaoPercentual,
          runs_total: totalRuns,
          runs_documentados: runsDocumentados,
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
              documentacao: documentacaoPercentual.toFixed(1),
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
