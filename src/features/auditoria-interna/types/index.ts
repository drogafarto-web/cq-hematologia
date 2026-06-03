/**
 * Auditoria Interna Domain Types (DICQ 1.3)
 *
 * Type hierarchy for audit execution, findings, and compliance tracking.
 * Multi-tenant: all entities scoped to `/labs/{labId}/auditorias-internas/` paths.
 *
 * Soft-delete only (RN-06): all entities have `deletadoEm: Timestamp | null`
 * LogicalSignature: { hash (SHA-256), operatorId, ts } for audit trail immutability
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * LogicalSignature — immutable audit marker
 *
 * Shared pattern with educacao-continuada.
 * - hash: SHA-256 of canonical JSON (64 hex chars)
 * - operatorId: request.auth.uid (creator/signer)
 * - ts: Timestamp of signature
 *
 * Rules validate: hash.size() == 64 + operatorId == request.auth.uid + ts is timestamp
 */
export interface LogicalSignature {
  readonly hash: string; // SHA-256 hex (64 chars)
  readonly operatorId: string; // request.auth.uid
  readonly ts: Timestamp; // when signed
}

/**
 * Auditoria — annual audit plan (DICQ 1.3)
 *
 * Container for one audit year. May have multiple sessions (Sessao) in the year
 * depending on `frequencia` (semestral, trimestral, mensal).
 */
export interface Auditoria {
  readonly id: string;
  readonly labId: string; // multi-tenant
  ano: number; // e.g., 2026
  frequencia: 'anual' | 'semestral' | 'trimestral' | 'mensal';
  responsavelTecnico: string; // userId
  proximaAuditoriaPlanejada: Timestamp;
  status: 'planejada' | 'em_execução' | 'finalizada';
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type AuditoriaInput = Omit<
  Auditoria,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

/**
 * Sessao — single audit execution (one session per audit plan)
 *
 * May be planejada → em-execução → finalizada.
 * Contains checklist items and findings (achados).
 */
export interface Sessao {
  readonly id: string;
  readonly auditoriaId: string; // FK back to Auditoria
  readonly labId: string; // multi-tenant
  auditor: string; // userId
  dataInicio: Timestamp;
  dataFim: Timestamp | null;
  status: 'planejada' | 'em-execução' | 'finalizada';
  totalItens: number;
  itensConforme: number;
  itensNãoConforme: number;
  itensNA: number;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type SessaoInput = Omit<
  Sessao,
  'id' | 'auditoriaId' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

/**
 * ChecklistItem — immutable question from DICQ template
 *
 * Created when a session is initialized with a template.
 * Response and severity are mutable; template reference is immutable.
 */
export interface ChecklistItem {
  readonly id: string;
  readonly sessaoId: string; // FK
  readonly labId: string; // multi-tenant
  readonly numeroDICQ: string; // e.g., "4.1.1.2"
  readonly descricao: string;
  readonly categoria: string; // e.g., "Organização e Responsabilidade"
  readonly bloco: string; // DICQ bloco: "A", "B", ..., "J"
  isApplicable: boolean;
  resposta: 'conforme' | 'não-conforme' | 'N/A' | null;
  severidade: 'crítica' | 'grave' | 'moderada' | 'leve' | 'observação' | null;
  observacoes: string;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

export type ChecklistItemInput = Omit<
  ChecklistItem,
  'id' | 'sessaoId' | 'labId' | 'criadoEm' | 'criadoPor'
>;

/**
 * Achado — finding from a checklist item (non-conformance)
 *
 * Severity crítica/grave auto-triggers NC creation via Cloud Function callable.
 * LogicalSignature immutable (soft-delete only).
 */
export interface Achado {
  readonly id: string;
  readonly sessaoId: string; // FK
  readonly labId: string; // multi-tenant
  readonly checklistItemId: string; // FK back to ChecklistItem
  descricao: string;
  evidencia: string; // URL or base64 or upload path
  severidade: 'crítica' | 'grave' | 'moderada' | 'leve' | 'observação';
  statusNC: 'pendente' | 'criada' | 'fechada';
  ncId?: string; // link to /naoConformidades/ if created
  assinatura: LogicalSignature; // immutable
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

export type AchadoInput = Omit<
  Achado,
  | 'id'
  | 'sessaoId'
  | 'labId'
  | 'criadoEm'
  | 'criadoPor'
  | 'deletadoEm'
  | 'statusNC'
  | 'ncId'
  | 'assinatura'
>;

/**
 * TemplateChecklist — seed data for checklist items (immutable after load)
 *
 * Contains ~115 DICQ items mapped to RDC 978/2025.
 * Used to populate a session's checklist via callable.
 */
export interface TemplateChecklistItem {
  readonly numeroDICQ: string;
  readonly descricao: string;
  readonly categoria: string;
  readonly bloco: string;
  readonly mapeamentoRDC: string; // e.g., "978:5.1"
  readonly isApplicable: boolean;
}

export interface TemplateChecklist {
  readonly id: string; // e.g., "dicq-4-3-rdc-978-v1"
  readonly nome: string;
  readonly versao: string;
  readonly descricao: string;
  readonly itens: TemplateChecklistItem[];
}

/**
 * Severity levels for findings
 */
export type SeveridadeAchado = 'crítica' | 'grave' | 'moderada' | 'leve' | 'observação';

/**
 * Status of session
 */
export type StatusSessao = 'planejada' | 'em-execução' | 'finalizada';

/**
 * Status of audit
 */
export type StatusAuditoria = 'planejada' | 'em_execução' | 'finalizada';

/**
 * Status of finding -> NC mapping
 */
export type StatusNC = 'pendente' | 'criada' | 'fechada';

/**
 * Frequency of audit execution
 */
export type FrequenciaAuditoria = 'anual' | 'semestral' | 'trimestral' | 'mensal';
