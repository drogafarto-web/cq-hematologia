import * as admin from 'firebase-admin';
import type {
  OperatorRankingEntry,
  ProblematicLotEntry,
  QCDecisionSection,
  QCModuleStats,
  OperacionalStatus,
} from '../types';

// ─── QC Decisions Aggregator ─────────────────────────────────────────────────
//
// Cross-módulo: lê runs de hematologia (lots/runs) e ciq-imuno/runs.
// Computa taxa de aprovação, tendência 7d vs 30d, ranking de operadores e
// lotes problemáticos. Status classificado por regras de cascata (ver doc).
//
// Fonte de verdade: Firestore Admin SDK. Sem N+1: lots em 1 snapshot, runs
// em Promise.all por lote.

const REJECTION_VIOLATIONS = new Set(['1-3s', '2-2s', 'R-4s', '4-1s', '10x', '6T', '6X']);

interface RawRun {
  moduleId: string;
  lotNumber: string;
  lotProduct: string;
  timestamp: admin.firestore.Timestamp;
  status: string;
  operatorName: string;
  operatorRole: string;
  violations: string[];
  rejectedTest: string | null;
  /** true quando a run foi considerada não-conforme pelo módulo. */
  nonConforming: boolean;
  isApproved: boolean;
  isRejected: boolean;
  isPending: boolean;
}

/**
 * Janela de 7 dias terminando em `to`. Usada para calcular tendência.
 */
function sevenDaysBefore(to: Date): Date {
  const out = new Date(to);
  out.setDate(out.getDate() - 7);
  out.setHours(0, 0, 0, 0);
  return out;
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function classifyStatus(
  modules: QCModuleStats[],
  operators: OperatorRankingEntry[],
  lots: ProblematicLotEntry[],
  reasons: string[],
): OperacionalStatus {
  let worst: OperacionalStatus = 'ok';

  // Regras críticas
  for (const m of modules) {
    if (m.totalRuns > 0 && m.approvalRate < 70) {
      reasons.push(`${m.moduleName}: taxa de aprovação em ${m.approvalRate.toFixed(1)}%`);
      worst = 'critico';
    }
  }
  if (lots.some((l) => l.shouldSegregate)) {
    reasons.push(`${lots.filter((l) => l.shouldSegregate).length} lote(s) com rejeição > 30%`);
    worst = 'critico';
  }

  // Regras de atenção (só elevam se ainda não crítico)
  if (worst !== 'critico') {
    for (const m of modules) {
      if (m.totalRuns === 0) continue;
      if (m.approvalRate >= 70 && m.approvalRate < 85) {
        reasons.push(`${m.moduleName}: taxa de aprovação em ${m.approvalRate.toFixed(1)}%`);
        worst = 'atencao';
      }
      if (m.trendDeltaPp !== null && m.trendDeltaPp < -10) {
        reasons.push(
          `${m.moduleName}: queda de ${Math.abs(m.trendDeltaPp).toFixed(1)}pp nos últimos 7 dias`,
        );
        worst = 'atencao';
      }
      for (const [violation, count] of Object.entries(m.westgardViolationsCount)) {
        if (count >= 3) {
          reasons.push(`${m.moduleName}: ${count} violações ${violation}`);
          worst = 'atencao';
          break;
        }
      }
    }
    if (operators.some((o) => o.isOutlier)) {
      reasons.push(`${operators.filter((o) => o.isOutlier).length} operador(es) outlier`);
      worst = 'atencao';
    }
  }

  return worst;
}

/**
 * Lê runs de hematologia (`labs/{labId}/lots/{lotId}/runs`).
 */
async function collectHematologiaRuns(
  db: admin.firestore.Firestore,
  labId: string,
  from: Date,
  to: Date,
): Promise<RawRun[]> {
  const lotsSnap = await db.collection(`labs/${labId}/lots`).get();
  if (lotsSnap.empty) return [];

  const runsBatches = await Promise.all(
    lotsSnap.docs.map((lotDoc) =>
      db
        .collection(`labs/${labId}/lots/${lotDoc.id}/runs`)
        .where('confirmedAt', '>=', admin.firestore.Timestamp.fromDate(from))
        .where('confirmedAt', '<=', admin.firestore.Timestamp.fromDate(to))
        .get()
        .then((runsSnap) => ({ lotDoc, runsSnap })),
    ),
  );

  const runs: RawRun[] = [];
  for (const { lotDoc, runsSnap } of runsBatches) {
    const lotData = lotDoc.data();
    const lotNumber: string = lotData['lotNumber'] ?? lotDoc.id;
    const lotProduct: string = lotData['nomeComercial'] ?? lotData['fabricante'] ?? '—';

    for (const runDoc of runsSnap.docs) {
      const r = runDoc.data();
      const confirmedAt: admin.firestore.Timestamp | undefined = r['confirmedAt'];
      if (!confirmedAt) continue;

      const status: string = r['status'] ?? 'Pendente';
      const violations: string[] = Array.isArray(r['westgardViolations'])
        ? r['westgardViolations']
        : [];
      const hasViolationRejection = violations.some((v) => REJECTION_VIOLATIONS.has(v));

      runs.push({
        moduleId: 'hematologia',
        lotNumber,
        lotProduct,
        timestamp: confirmedAt,
        status,
        operatorName: r['operatorName'] ?? 'Operador não identificado',
        operatorRole: r['operatorRole'] ?? 'operador',
        violations,
        // Hematologia não tem "teste rejeitado" discreto — usa o pior analito violado
        rejectedTest: violations.length > 0 ? violations[0] : null,
        nonConforming: status === 'Rejeitada' || hasViolationRejection,
        isApproved: status === 'Aprovada',
        isRejected: status === 'Rejeitada',
        isPending: status === 'Pendente',
      });
    }
  }

  return runs;
}

/**
 * Lê runs de imunologia (`labs/{labId}/ciq-imuno/{lotId}/runs`).
 */
async function collectImunoRuns(
  db: admin.firestore.Firestore,
  labId: string,
  from: Date,
  to: Date,
): Promise<RawRun[]> {
  const lotsSnap = await db.collection(`labs/${labId}/ciq-imuno`).get();
  if (lotsSnap.empty) return [];

  const runsBatches = await Promise.all(
    lotsSnap.docs.map((lotDoc) =>
      db
        .collection(`labs/${labId}/ciq-imuno/${lotDoc.id}/runs`)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(from))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(to))
        .get()
        .then((runsSnap) => ({ lotDoc, runsSnap })),
    ),
  );

  const runs: RawRun[] = [];
  for (const { lotDoc, runsSnap } of runsBatches) {
    const lotData = lotDoc.data();
    const lotNumber: string = lotData['loteControle'] ?? lotDoc.id;
    const lotProduct: string = lotData['fabricante'] ?? 'Controle imuno';

    for (const runDoc of runsSnap.docs) {
      const r = runDoc.data();
      const createdAt: admin.firestore.Timestamp | undefined = r['createdAt'];
      if (!createdAt) continue;

      const expected: string = r['resultadoEsperado'] ?? '';
      const obtained: string = r['resultadoObtido'] ?? '';
      const isConform = expected !== '' && expected === obtained;
      const nonConforming = !isConform;

      runs.push({
        moduleId: 'imunologia',
        lotNumber,
        lotProduct,
        timestamp: createdAt,
        // No CIQ-Imuno o conceito é Conforme/Não Conforme — mapeamos para
        // Aprovada/Rejeitada para ranking e KPIs uniformes.
        status: isConform ? 'Aprovada' : 'Rejeitada',
        operatorName: r['operatorName'] ?? 'Operador não identificado',
        operatorRole: r['operatorRole'] ?? 'operador',
        violations: Array.isArray(r['westgardCategorico']) ? r['westgardCategorico'] : [],
        rejectedTest: r['testType'] ?? null,
        nonConforming,
        isApproved: isConform,
        isRejected: nonConforming,
        isPending: false,
      });
    }
  }

  return runs;
}

function computeModuleStats(
  moduleId: string,
  moduleName: string,
  all: RawRun[],
  sevenDayCutoff: Date,
): QCModuleStats {
  const modRuns = all.filter((r) => r.moduleId === moduleId);
  const total = modRuns.length;
  const approved = modRuns.filter((r) => r.isApproved).length;
  const rejected = modRuns.filter((r) => r.isRejected).length;
  const pending = modRuns.filter((r) => r.isPending).length;

  const approvalRate30d = rate(approved, total);

  const recentRuns = modRuns.filter((r) => r.timestamp.toDate() >= sevenDayCutoff);
  const approvalRate7d =
    recentRuns.length > 0
      ? rate(recentRuns.filter((r) => r.isApproved).length, recentRuns.length)
      : null;

  const trendDeltaPp =
    approvalRate7d === null
      ? null
      : Number((approvalRate7d - approvalRate30d).toFixed(1));

  const westgardViolationsCount: Record<string, number> = {};
  for (const r of modRuns) {
    for (const v of r.violations) {
      westgardViolationsCount[v] = (westgardViolationsCount[v] ?? 0) + 1;
    }
  }

  const rejectedTestCounts = new Map<string, number>();
  for (const r of modRuns) {
    if (r.isRejected && r.rejectedTest) {
      rejectedTestCounts.set(r.rejectedTest, (rejectedTestCounts.get(r.rejectedTest) ?? 0) + 1);
    }
  }

  const topRejectedTests = Array.from(rejectedTestCounts.entries())
    .map(([testName, rejections]) => ({ testName, rejections }))
    .sort((a, b) => b.rejections - a.rejections)
    .slice(0, 3);

  return {
    moduleId,
    moduleName,
    totalRuns: total,
    approved,
    rejected,
    pending,
    approvalRate: approvalRate30d,
    approvalRate7d,
    approvalRate30d,
    trendDeltaPp,
    westgardViolationsCount,
    topRejectedTests,
  };
}

function computeOperatorRanking(runs: RawRun[]): OperatorRankingEntry[] {
  type Agg = { name: string; role: string; runs: number; rejections: number };
  const map = new Map<string, Agg>();
  for (const r of runs) {
    const key = `${r.operatorName}::${r.operatorRole}`;
    const agg = map.get(key) ?? { name: r.operatorName, role: r.operatorRole, runs: 0, rejections: 0 };
    agg.runs++;
    if (r.isRejected) agg.rejections++;
    map.set(key, agg);
  }

  const entries = Array.from(map.values()).map<OperatorRankingEntry>((a) => ({
    operatorName: a.name,
    operatorRole: a.role,
    runsProcessed: a.runs,
    rejections: a.rejections,
    rejectionRate: rate(a.rejections, a.runs),
    isOutlier: false,
  }));

  // Outlier: rejeição > média + 2σ (usando operadores com ≥ 5 runs — evita
  // falso-positivo de quem fez uma única run rejeitada).
  const qualified = entries.filter((e) => e.runsProcessed >= 5);
  if (qualified.length >= 3) {
    const mean =
      qualified.reduce((s, e) => s + e.rejectionRate, 0) / qualified.length;
    const variance =
      qualified.reduce((s, e) => s + Math.pow(e.rejectionRate - mean, 2), 0) /
      qualified.length;
    const sd = Math.sqrt(variance);
    const threshold = mean + 2 * sd;
    for (const e of entries) {
      if (e.runsProcessed >= 5 && e.rejectionRate > threshold && e.rejections > 0) {
        e.isOutlier = true;
      }
    }
  }

  return entries.sort((a, b) => b.runsProcessed - a.runsProcessed);
}

function computeProblematicLots(runs: RawRun[]): ProblematicLotEntry[] {
  type Agg = { lotNumber: string; product: string; moduleId: string; runs: number; rej: number };
  const map = new Map<string, Agg>();
  for (const r of runs) {
    const key = `${r.moduleId}::${r.lotNumber}`;
    const agg =
      map.get(key) ??
      {
        lotNumber: r.lotNumber,
        product: r.lotProduct,
        moduleId: r.moduleId,
        runs: 0,
        rej: 0,
      };
    agg.runs++;
    if (r.isRejected) agg.rej++;
    map.set(key, agg);
  }

  return Array.from(map.values())
    .filter((a) => a.runs >= 3) // lotes com amostra mínima
    .map<ProblematicLotEntry>((a) => {
      const rejectionRate = rate(a.rej, a.runs);
      return {
        lotNumber: a.lotNumber,
        product: a.product,
        moduleId: a.moduleId,
        totalRuns: a.runs,
        rejections: a.rej,
        rejectionRate,
        shouldSegregate: rejectionRate > 30,
      };
    })
    .filter((e) => e.rejectionRate > 20)
    .sort((a, b) => b.rejectionRate - a.rejectionRate);
}

export async function aggregateQCDecisions(
  db: admin.firestore.Firestore,
  labId: string,
  from: Date,
  to: Date,
): Promise<QCDecisionSection> {
  const [hemaRuns, imunoRuns] = await Promise.all([
    collectHematologiaRuns(db, labId, from, to),
    collectImunoRuns(db, labId, from, to),
  ]);

  const allRuns = [...hemaRuns, ...imunoRuns];
  const sevenDayCutoff = sevenDaysBefore(to);

  // Módulos são incluídos no array apenas se houve atividade no período —
  // módulos sem runs não poluem o relatório.
  const modules: QCModuleStats[] = [];
  if (hemaRuns.length > 0) {
    modules.push(
      computeModuleStats('hematologia', 'Hematologia (CIQ Quantitativo)', allRuns, sevenDayCutoff),
    );
  }
  if (imunoRuns.length > 0) {
    modules.push(
      computeModuleStats('imunologia', 'Imunologia (CIQ-Imuno)', allRuns, sevenDayCutoff),
    );
  }

  const operatorRanking = computeOperatorRanking(allRuns);
  const problematicLots = computeProblematicLots(allRuns);

  const statusReasons: string[] = [];
  const status = classifyStatus(modules, operatorRanking, problematicLots, statusReasons);

  const totalRuns = allRuns.length;
  const totalApproved = allRuns.filter((r) => r.isApproved).length;
  const totalRejected = allRuns.filter((r) => r.isRejected).length;

  return {
    periodStart: from,
    periodEnd: to,
    modules,
    operatorRanking,
    problematicLots,
    status,
    statusReasons,
    totalRuns,
    totalApproved,
    totalRejected,
    globalApprovalRate: totalRuns > 0 ? rate(totalApproved, totalRuns) : null,
  };
}
