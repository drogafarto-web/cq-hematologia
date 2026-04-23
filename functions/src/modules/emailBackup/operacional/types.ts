/**
 * Tipos do Relatório Operacional — segundo anexo PDF do email diário.
 *
 * Documento separado do backup por 3 motivos:
 *   1. Consumidor é humano (RT/supervisor), não auditor externo.
 *   2. Conteúdo é decision-oriented — KPIs, rankings, timelines.
 *   3. Ciclo de vida é curto (leitura diária, descarte mensal) vs 5+ anos do backup.
 *
 * As 3 seções (QC Decisions, Rastreabilidade, Audit Log) cross-referenciam
 * as mesmas entidades (run, lote, operador) — ficam no mesmo PDF para não
 * triplicar o custo de auditoria e quebrar navegação.
 */

import type * as admin from 'firebase-admin';

// ─── Status global do relatório ──────────────────────────────────────────────

export type OperacionalStatus = 'ok' | 'atencao' | 'critico';

// ─── Seção 1 — QC Decisions ──────────────────────────────────────────────────

export interface QCModuleStats {
  moduleId: string;
  moduleName: string;
  totalRuns: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;        // 0..100, 1 casa decimal
  approvalRate7d: number | null;
  approvalRate30d: number;
  trendDeltaPp: number | null; // 7d − 30d, em pontos percentuais (negativo = caindo)
  westgardViolationsCount: Record<string, number>;
  topRejectedTests: Array<{ testName: string; rejections: number }>;
}

export interface OperatorRankingEntry {
  operatorName: string;
  operatorRole: string;
  runsProcessed: number;
  rejections: number;
  rejectionRate: number; // 0..100
  isOutlier: boolean;    // > média + 2σ do lab
}

export interface ProblematicLotEntry {
  lotNumber: string;
  product: string;
  moduleId: string;
  totalRuns: number;
  rejections: number;
  rejectionRate: number;
  shouldSegregate: boolean; // > 30%
}

export interface QCDecisionSection {
  periodStart: Date;
  periodEnd: Date;
  modules: QCModuleStats[];
  operatorRanking: OperatorRankingEntry[];
  problematicLots: ProblematicLotEntry[];
  status: OperacionalStatus;
  /** Lista de motivos para o status atual — renderizado no sumário executivo. */
  statusReasons: string[];
  /** Totais agregados para a capa — soma de runs em todos os módulos. */
  totalRuns: number;
  totalApproved: number;
  totalRejected: number;
  globalApprovalRate: number | null; // null quando não há runs
}

// ─── Seção 2 — Rastreabilidade ───────────────────────────────────────────────

export type LotAlertCode =
  | 'EXPIRED_IN_USE'
  | 'OPENED_WITHOUT_DATE'
  | 'MISSING_ANVISA_REG'
  | 'POST_OPENING_EXPIRED'
  | 'HIGH_REJECTION_RATE'
  | 'SEGREGATED';

export interface LotAlert {
  code: LotAlertCode;
  severity: 'critical' | 'warning';
  message: string;
}

export interface LotLifecycleRecord {
  insumoId: string;
  lotNumber: string;
  tipo: string;
  nomeComercial: string;
  fabricante: string;
  registroAnvisa: string | null;
  validadeFabricante: string | null;
  // Timeline
  dataEntrada: string | null;
  dataAbertura: string | null;
  dataFechamento: string | null;
  dataDescarte: string | null;
  diasEmUso: number | null;
  validadePosAbertura: string | null;
  // Uso
  runsCount: number;
  approvalRate: number | null;
  modulosUsados: string[];
  status: string;
  alerts: LotAlert[];
}

export interface RastreabilidadeSection {
  activeLots: LotLifecycleRecord[];
  closedLots: LotLifecycleRecord[];
  alertsCount: {
    critical: number;
    warning: number;
  };
  status: OperacionalStatus;
}

// ─── Seção 3 — Audit Log ─────────────────────────────────────────────────────

export type CIQAuditAction =
  | 'CREATE_RUN'
  | 'APPROVE_RUN'
  | 'REJECT_RUN'
  | 'EDIT_RUN_VALUE'
  | 'REOPEN_RUN'
  | 'ATTACH_CORRECTIVE_ACTION'
  | 'OPEN_LOT'
  | 'CLOSE_LOT'
  | 'DISCARD_LOT'
  | 'SEGREGATE_LOT'
  | 'NOTIVISA_SUBMIT'
  | 'NOTIVISA_UPDATE';

export type CIQAuditSeverity = 'info' | 'warning' | 'critical';

export interface CIQAuditEvent {
  id: string;
  labId: string;
  moduleId: string;
  timestamp: admin.firestore.Timestamp;
  action: CIQAuditAction;
  entityType: 'run' | 'lot' | 'insumo';
  entityId: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  reason?: string;
  severity: CIQAuditSeverity;
  previousHash: string;
  contentHash: string;
  chainHash: string;
}

export interface ChainBreak {
  eventId: string;
  expectedChainHash: string;
  foundChainHash: string;
}

export interface AuditLogSection {
  /** Eventos foram coletados (trigger ativo) ou seção aguarda deploy. */
  collectionActive: boolean;
  totalEvents: number;
  byAction: Record<string, number>;
  bySeverity: { info: number; warning: number; critical: number };
  byActor: Array<{ actorName: string; actorRole: string; count: number }>;
  criticalEvents: CIQAuditEvent[];
  recentEvents: CIQAuditEvent[]; // últimos N para timeline — cap em 120
  chain: {
    eventsVerified: number;
    valid: boolean;
    breaks: ChainBreak[];
  };
  truncated: boolean; // true se o período tinha mais eventos do que o cap
  status: OperacionalStatus;
}

// ─── Relatório completo ──────────────────────────────────────────────────────

export interface OperacionalReport {
  labId: string;
  labName: string;
  labCnpj?: string;
  labAddress?: string;
  responsibleTech?: { name: string; registration: string };
  sanitaryLicense?: { number: string; validUntil: string };
  periodStart: Date;
  periodEnd: Date;
  generatedAt: string;
  qcDecisions: QCDecisionSection;
  rastreabilidade: RastreabilidadeSection;
  auditLog: AuditLogSection;
  /** Pior status entre as 3 seções. Usado no subject do email. */
  globalStatus: OperacionalStatus;
  contentHash: string;
}
