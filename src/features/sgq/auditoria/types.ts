/**
 * ADR 0005 compliance — Audit Trail Types
 *
 * Schema for audit entry with HMAC-SHA256 chain validation.
 * Firestore paths:
 *   - /labs/{labId}/audit-trail/{entryId} — compliance audit log
 *   - /ciq-audit/{entryId} — CIQ analysis audit (deprecated in Phase 2)
 *   - /labs/{labId}/nao-conformidades/{ncId}/_events/{eventId} — NC lifecycle
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Audit Entry (generalized) ────────────────────────────────────────────

export interface AuditEntry {
  readonly id: string;
  readonly labId: string;

  /** Operation identifier (e.g., 'insumo.recebido', 'laudo.liberado', 'nc.aberta') */
  operation: string;

  /** Operator who performed the action */
  operatorId: string;
  operatorName?: string;

  /** Module touched (e.g., 'insumos', 'ciq-imuno', 'sgq', 'educacao-continuada') */
  modulo: string;

  /** Human-readable action description */
  acao: string;

  /** Operation result ('sucesso' | 'falha' | 'aviso') */
  resultado: 'sucesso' | 'falha' | 'aviso';

  /** Structured payload of what changed */
  payload: Record<string, unknown>;

  // ─── Chain integrity fields (ADR 0005) ────────────────────────────────────

  /** HMAC-SHA256 of deterministic JSON (excludes hmac/hash/previousHash) */
  hmac: string;

  /** SHA-256 of entire entry including hmac */
  hash: string;

  /** Hash of previous entry in sequence (chain link) */
  previousHash: string | null;

  // ─── Timing ────────────────────────────────────────────────────────────

  /** Server-generated timestamp (never client) */
  readonly timestamp: Timestamp;

  // ─── Migration fields ──────────────────────────────────────────────────

  /** For legacy entries without HMAC format */
  _migratedAt?: Timestamp;
  _legacyHash?: string;

  readonly deletadoEm: Timestamp | null;
}

// ─── Filters ───────────────────────────────────────────────────────────────

export interface AuditTrailFilters {
  operadorId?: string;
  modulo?: string;
  acao?: string;
  resultado?: 'sucesso' | 'falha' | 'aviso';
  dataInicio?: Date;
  dataFim?: Date;
  busca?: string; // free text search on acao / payload
}

// ─── Chain Validation Result ──────────────────────────────────────────────

export interface ChainValidationResult {
  valid: boolean;
  startId: string;
  endId: string;
  entriesChecked: number;
  violations: Array<{
    entryId: string;
    reason: 'hmac-mismatch' | 'hash-sequence-broken' | 'missing-hash' | 'order-violation';
    expected?: string;
    actual?: string;
  }>;
  stats: {
    scanned: number;
    valid: number;
    invalid: number;
    durationMs: number;
  };
}

// ─── Compliance Report ─────────────────────────────────────────────────────

export interface ComplianceReport {
  readonly labId: string;
  readonly generatedAt: Timestamp;
  readonly generatedBy: string;

  dateRange: {
    inicio: Date;
    fim: Date;
  };

  summary: {
    totalEntries: number;
    operatorsInvolved: number;
    modulesCovered: string[];
    successCount: number;
    failureCount: number;
    warningCount: number;
  };

  chainStatus: 'válida' | 'inválida' | 'parcial';
  chainViolations?: Array<{
    entryId: string;
    reason: string;
  }>;

  rdc978Compliance: {
    auditTrailComplete: boolean; // Art. 128 — operations logged with operator
    noGapsinSequence: boolean; // RDC § 5.3
    hmacIntegrityValid: boolean; // DICQ 4.4
  };

  dicq44Compliance: {
    entriesImmutable: boolean;
    operatorIdentification: boolean; // operadorId on every entry
    timestampServerGenerated: boolean;
    auditTrailIsolated: boolean;
  };

  reportPayload?: Record<string, unknown>;
}

// ─── Operator Activity ─────────────────────────────────────────────────────

export interface OperatorActivityReport {
  operatorId: string;
  operatorName?: string;
  dateRange: {
    inicio: Date;
    fim: Date;
  };

  timeline: Array<{
    timestamp: Date;
    operation: string;
    modulo: string;
    acao: string;
    resultado: 'sucesso' | 'falha' | 'aviso';
  }>;

  summary: {
    totalActions: number;
    successCount: number;
    failureCount: number;
    warningCount: number;
    modulesAccessed: string[];
  };
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export type AuditEntryInput = Omit<
  AuditEntry,
  'id' | 'labId' | 'hmac' | 'hash' | 'previousHash' | 'timestamp' | 'deletadoEm'
>;

// ─── Logical Signature (RDC 978 Art. 128 + DICQ 4.4) ────────────────────────

export interface LogicalSignature {
  hash: string; // 64-char hex (SHA-256)
  operatorId: string;
  ts: Timestamp;
}

// ─── Sessão (audit session) ────────────────────────────────────────────────

export interface Sessao {
  readonly id: string;
  readonly labId: string;
  readonly auditoriaId: string;

  numero: string; // e.g., 'SESS-2026-001'
  dataInicio: Timestamp;
  dataFim: Timestamp | null;

  // ─── Multi-auditor support (FR-42)
  auditorLider?: string; // operatorId do auditor líder
  auditoresAuxiliares?: string[]; // operatorIds adicionais

  status: 'aberta' | 'encerrada' | 'cancelada';
  motivo?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type SessaoInput = Omit<Sessao, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>;

// ─── Auditoria (audit plan + execution) ────────────────────────────────────

export interface Auditoria {
  readonly id: string;
  readonly labId: string;

  numero: string; // e.g., 'AUD-2026-001'
  titulo: string;
  descricao?: string;

  // ─── Scope + Re-audit support (FR-42)
  tipoExecucao?: 'inicial' | 'reAuditoria';
  auditoriaOriginalId?: string; // FK quando tipoExecucao === 'reAuditoria'
  escopoSetores?: string[]; // ['Bioquímica', 'Imuno', ...]
  escopoEspecialidades?: string[];

  dataPlanehadaPara: Timestamp;
  dataRealizada: Timestamp | null;

  status: 'planejada' | 'em_execucao' | 'concluida' | 'cancelada';

  // ─── Approval chain
  aprovacoes?: LogicalSignature[]; // múltiplas: Direção + QC

  responsavel: string; // operatorId
  observacoes?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type AuditoriaInput = Omit<
  Auditoria,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

// ─── Presença em reunião de auditoria (FR-45) ──────────────────────────────

export type PapelPresenca = 'auditor' | 'auditado' | 'observador' | 'rt' | 'gerente_qc' | 'direcao';

export interface Presenca {
  readonly id: string;
  readonly sessaoId: string;
  readonly labId: string;
  readonly auditoriaId: string;

  userId: string; // operatorId
  nome: string; // snapshot at time of signing
  papel: PapelPresenca;
  reuniao: 'abertura' | 'encerramento';
  assinatura: LogicalSignature;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type PresencaInput = Omit<
  Presenca,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm' | 'assinatura'
>;

// ─── Reunião de auditoria (opening + closing) ──────────────────────────────

export interface ReuniaoAuditoria {
  readonly id: string;
  readonly sessaoId: string;
  readonly labId: string;
  readonly auditoriaId: string;

  tipo: 'abertura' | 'encerramento';
  dataHora: Timestamp;
  pauta: string; // min 10 chars
  concluidaEm: Timestamp | null;
  totalPresentes: number;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type ReuniaoAuditoriaInput = Omit<
  ReuniaoAuditoria,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

// ─── Plano de Ação (action item from audit finding) ────────────────────────

export interface PlanoAcao {
  readonly id: string;
  readonly labId: string;
  readonly auditoriaId: string;

  numero: string; // e.g., 'PA-2026-001'
  descricao: string;
  responsavel: string; // operatorId
  dataLimite: Timestamp;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';

  status: 'aberto' | 'em_execucao' | 'concluido' | 'cancelado';

  // ─── Execution tracking
  evidenciaUrl?: string; // link para evidência de execução
  assinatura?: LogicalSignature; // assinatura ao concluir

  observacoes?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type PlanoAcaoInput = Omit<
  PlanoAcao,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;
