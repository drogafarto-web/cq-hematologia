import * as admin from 'firebase-admin';
import type { ModuleCollector, ModuleBackupSection, StalenessAlert, BackupRow } from '../types';

// ─── Hematologia Collector ────────────────────────────────────────────────────
//
// Collects data from /labs/{labId}/lots/{lotId}/runs/{runId} for the backup.
// Each run is a CQRun with analyte values, Westgard violations, and operator info.

const MODULE_ID   = 'hematologia';
const MODULE_NAME = 'Hematologia (CIQ Quantitativo)';

// Westgard violations that trigger rejection (excluding warnings)
const REJECTION_VIOLATIONS = new Set(['1-3s', '2-2s', 'R-4s', '4-1s', '10x', '6T', '6X']);

export const hematologiaCollector: ModuleCollector = {
  moduleId:   MODULE_ID,
  moduleName: MODULE_NAME,

  async collect(
    db: admin.firestore.Firestore,
    labId: string,
    from: Date,
    to: Date,
  ): Promise<ModuleBackupSection | null> {
    // 1. Get all active lots for the lab
    const lotsSnap = await db
      .collection(`labs/${labId}/lots`)
      .get();

    if (lotsSnap.empty) return null;

    const rows: BackupRow[]    = [];
    let totalRuns              = 0;
    let nonConforming          = 0;
    let lastRunDate: string | null = null;
    const approvedCount        = { value: 0 };
    const rejectedCount        = { value: 0 };
    const pendingCount         = { value: 0 };
    const operatorSet          = new Set<string>();

    // 2. For each lot, query runs within the period
    for (const lotDoc of lotsSnap.docs) {
      const lotData = lotDoc.data();

      const runsSnap = await db
        .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
        .where('confirmedAt', '>=', admin.firestore.Timestamp.fromDate(from))
        .where('confirmedAt', '<=', admin.firestore.Timestamp.fromDate(to))
        .orderBy('confirmedAt', 'asc')
        .get();

      for (const runDoc of runsSnap.docs) {
        const r = runDoc.data();
        totalRuns++;

        const confirmedAt: admin.firestore.Timestamp = r['confirmedAt'];
        const dateStr = confirmedAt.toDate().toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        });
        const timeStr = confirmedAt.toDate().toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour:   '2-digit',
          minute: '2-digit',
        });

        const violations: string[] = r['westgardViolations'] ?? [];
        const hasRejection = violations.some(v => REJECTION_VIOLATIONS.has(v));
        const status: string = r['status'] ?? 'Pendente';

        if (status === 'Aprovada')  approvedCount.value++;
        if (status === 'Rejeitada') rejectedCount.value++;
        if (status === 'Pendente')  pendingCount.value++;
        if (status === 'Rejeitada' || hasRejection) nonConforming++;

        const operatorName: string = r['operatorName'] ?? '—';
        operatorSet.add(operatorName);

        // Track most recent run date
        const isoDate = confirmedAt.toDate().toISOString().slice(0, 10);
        if (!lastRunDate || isoDate > lastRunDate) lastRunDate = isoDate;

        rows.push({
          'Data':       `${dateStr} ${timeStr}`,
          'Lote':       lotData['lotNumber'] ?? lotDoc.id,
          'Nível':      String(r['level'] ?? '—'),
          'Equipamento': r['equipmentId'] ?? lotData['equipmentName'] ?? '—',
          'Status':     status,
          'Westgard':   violations.length > 0 ? violations.join(', ') : '—',
          'IA editado': r['isEdited'] ? 'Sim' : 'Não',
          'Operador':   operatorName,
          'Cargo':      r['operatorRole'] ?? '—',
          'Assinatura': (r['logicalSignature']?.slice(0, 12) ?? '—') + '…',
        });
      }
    }

    if (totalRuns === 0) return null;

    const approvalRate = totalRuns > 0
      ? ((approvedCount.value / totalRuns) * 100).toFixed(1)
      : '0.0';

    return {
      moduleId:          MODULE_ID,
      moduleName:        MODULE_NAME,
      lastRunDate,
      totalRuns,
      nonConformingRuns: nonConforming,
      columns: [
        'Data', 'Lote', 'Nível', 'Equipamento',
        'Status', 'Westgard', 'IA editado', 'Operador', 'Cargo', 'Assinatura',
      ],
      rows,
      summary: {
        'Total de corridas':    String(totalRuns),
        'Aprovadas':            String(approvedCount.value),
        'Rejeitadas':           String(rejectedCount.value),
        'Pendentes':            String(pendingCount.value),
        'Não conformidades':    String(nonConforming),
        'Taxa de aprovação':    `${approvalRate}%`,
        'Operadores distintos': String(operatorSet.size),
        'Lotes cobertos':       String(lotsSnap.size),
      },
    };
  },

  async checkStaleness(
    db: admin.firestore.Firestore,
    labId: string,
    thresholdDays: number,
  ): Promise<StalenessAlert | null> {
    const lotsSnap = await db.collection(`labs/${labId}/lots`).limit(1).get();
    if (lotsSnap.empty) return null; // No lots = module not in use

    // Find the most recent run across all lots
    let mostRecentTimestamp: admin.firestore.Timestamp | null = null;

    const allLotsSnap = await db.collection(`labs/${labId}/lots`).get();
    for (const lotDoc of allLotsSnap.docs) {
      const lastRunSnap = await db
        .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
        .orderBy('confirmedAt', 'desc')
        .limit(1)
        .get();

      if (!lastRunSnap.empty) {
        const ts: admin.firestore.Timestamp = lastRunSnap.docs[0].data()['confirmedAt'];
        if (!mostRecentTimestamp || ts.seconds > mostRecentTimestamp.seconds) {
          mostRecentTimestamp = ts;
        }
      }
    }

    if (!mostRecentTimestamp) {
      // Has lots but zero runs at all
      return {
        moduleId:         MODULE_ID,
        moduleName:       MODULE_NAME,
        daysSinceLastRun: Infinity,
        level:            'critical',
        lastRunAt:        null,
      };
    }

    const now             = Date.now();
    const lastRunMs       = mostRecentTimestamp.toDate().getTime();
    const daysSinceLastRun = (now - lastRunMs) / (1000 * 60 * 60 * 24);

    if (daysSinceLastRun < thresholdDays) return null;

    return {
      moduleId:         MODULE_ID,
      moduleName:       MODULE_NAME,
      daysSinceLastRun: Math.floor(daysSinceLastRun),
      level:            daysSinceLastRun >= 7 ? 'critical' : 'warning',
      lastRunAt:        mostRecentTimestamp.toDate().toISOString(),
    };
  },
};
