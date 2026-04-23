import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import type { OperacionalReport, OperacionalStatus } from './types';
import { aggregateQCDecisions } from './aggregators/qcDecisions';
import { aggregateRastreabilidade } from './aggregators/rastreabilidade';
import { aggregateAuditLog } from './aggregators/auditLog';

// ─── Operational Report Assembler ────────────────────────────────────────────
//
// Monta o relatório operacional (3 seções) em paralelo. Isolamento total por
// `labId` — aggregators são stateless e não compartilham estado entre labs.

function worstStatus(statuses: OperacionalStatus[]): OperacionalStatus {
  if (statuses.includes('critico')) return 'critico';
  if (statuses.includes('atencao')) return 'atencao';
  return 'ok';
}

function computeOperacionalContentHash(
  report: Omit<OperacionalReport, 'contentHash'>,
): string {
  const payload = JSON.stringify({
    labId: report.labId,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    qc: {
      total: report.qcDecisions.totalRuns,
      approved: report.qcDecisions.totalApproved,
      rejected: report.qcDecisions.totalRejected,
      status: report.qcDecisions.status,
      modules: report.qcDecisions.modules.map((m) => ({
        id: m.moduleId,
        total: m.totalRuns,
        approved: m.approved,
        rate: m.approvalRate,
      })),
    },
    rast: {
      active: report.rastreabilidade.activeLots.length,
      closed: report.rastreabilidade.closedLots.length,
      alerts: report.rastreabilidade.alertsCount,
      status: report.rastreabilidade.status,
    },
    audit: {
      active: report.auditLog.collectionActive,
      total: report.auditLog.totalEvents,
      critical: report.auditLog.bySeverity.critical,
      chainValid: report.auditLog.chain.valid,
      status: report.auditLog.status,
    },
    globalStatus: report.globalStatus,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export interface LabIdentity {
  labId: string;
  labName: string;
  labCnpj?: string;
  labAddress?: string;
  responsibleTech?: { name: string; registration: string };
  sanitaryLicense?: { number: string; validUntil: string };
}

export async function assembleOperacionalReport(
  db: admin.firestore.Firestore,
  identity: LabIdentity,
  from: Date,
  to: Date,
): Promise<OperacionalReport> {
  const [qc, rast, audit] = await Promise.all([
    aggregateQCDecisions(db, identity.labId, from, to),
    aggregateRastreabilidade(db, identity.labId, from, to),
    aggregateAuditLog(db, identity.labId, from, to),
  ]);

  const globalStatus = worstStatus([qc.status, rast.status, audit.status]);

  const withoutHash: Omit<OperacionalReport, 'contentHash'> = {
    labId: identity.labId,
    labName: identity.labName,
    labCnpj: identity.labCnpj,
    labAddress: identity.labAddress,
    responsibleTech: identity.responsibleTech,
    sanitaryLicense: identity.sanitaryLicense,
    periodStart: from,
    periodEnd: to,
    generatedAt: new Date().toISOString(),
    qcDecisions: qc,
    rastreabilidade: rast,
    auditLog: audit,
    globalStatus,
  };

  const contentHash = computeOperacionalContentHash(withoutHash);
  return { ...withoutHash, contentHash };
}

/**
 * `true` quando vale a pena emitir o relatório. Critério: existe atividade
 * de CIQ no período, lotes ativos, ou eventos de audit coletados. Caso
 * contrário, o lab não tem o que reportar hoje.
 */
export function hasOperacionalContent(report: OperacionalReport): boolean {
  return (
    report.qcDecisions.totalRuns > 0 ||
    report.rastreabilidade.activeLots.length > 0 ||
    report.rastreabilidade.closedLots.length > 0 ||
    (report.auditLog.collectionActive && report.auditLog.totalEvents > 0)
  );
}
