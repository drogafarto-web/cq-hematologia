/**
 * LGPD Feature Module — Type Definitions
 *
 * Data Protection Impact Assessment (DPIA), Privacy Policy versioning,
 * user acceptance tracking, and PII deletion operations.
 *
 * Firestore paths:
 * - /labs/{labId}/lgpd/dpia/{docId}
 * - /labs/{labId}/lgpd/politicas/{docId}
 * - /users/{userId}/privacyAceites/{docId}
 *
 * Multi-tenant enforcement: all collections carry labId redundantly.
 * Soft-delete only (RN-06): deletadoEm field, never hard-delete.
 * Chain-hash preservation: LogicalSignature fields preserved during PII deletion.
 */

import type { Timestamp } from 'firebase/firestore';

// ──────────────────────────────────────────────────────────────────────────
// Logical Signature (copied from auditoria module for consistency)
// ──────────────────────────────────────────────────────────────────────────

export interface LogicalSignature {
  /** SHA-256 hash (64 hex chars) — immutable once created */
  hash: string;
  /** User ID (request.auth.uid) who created/signed */
  operatorId: string;
  /** Server timestamp at creation */
  ts: Timestamp;
}

// ──────────────────────────────────────────────────────────────────────────
// DPIA (Data Protection Impact Assessment)
// ──────────────────────────────────────────────────────────────────────────

export interface DPIADataColetada {
  /** Field name (e.g., "nome", "email", "cpf") */
  campo: string;
  /** Purpose of collection (e.g., "Identificação do titular") */
  proposito: string;
  /** Retention period (e.g., "6 meses", "5 anos") */
  retencao: string;
}

export interface DPIAFluxoDados {
  /** Data entry point (e.g., "Formulário web", "Import XLSX") */
  entrada: string;
  /** Processing (e.g., "Validação em Cloud Function", "Armazenamento Firestore") */
  processamento: string;
  /** Data exit point (e.g., "Relatório PDF", "Exportação XLSX") */
  saida: string;
}

export interface DPIARisco {
  /** Risk category */
  tipo: 'conformidade' | 'seguranca' | 'reputacao';
  /** Risk description */
  descricao: string;
  /** Likelihood assessment */
  probabilidade: 'baixa' | 'media' | 'alta';
  /** Impact assessment */
  impacto: 'baixo' | 'medio' | 'alto';
}

export interface DPIAMedida {
  /** Mitigation measure description */
  medida: string;
  /** Responsible person (name or role) */
  responsavel: string;
  /** Deadline for implementation */
  prazo: string;
}

export interface DPIA {
  readonly id: string;
  readonly labId: string;

  /** Versioning: incremented on each save */
  versao: number;

  /** Timestamp when filled out */
  dataPreenchimento: Timestamp;

  /** UID of person responsible for data handling */
  responsavelDados: string;

  /** Array of collected data fields */
  datasColetadas: DPIADataColetada[];

  /** Data flow documentation */
  fluxosDados: DPIAFluxoDados[];

  /** Identified risks (compliance, security, reputation) */
  riscos: DPIARisco[];

  /** Mitigation measures */
  medidas: DPIAMedida[];

  /** Legal review completed */
  revisaoJuridica: boolean;

  /** Approval timestamp (when revisaoJuridica was confirmed) */
  dataAprovacao?: Timestamp;

  /** RT (Responsável Técnico) signature — optional for now */
  assinaturRT?: LogicalSignature;

  readonly criadoEm: Timestamp;
  readonly atualizadoEm: Timestamp;
  readonly deletadoEm?: Timestamp;
}

// ──────────────────────────────────────────────────────────────────────────
// Privacy Policy Versioning
// ──────────────────────────────────────────────────────────────────────────

export interface PolicyVersion {
  readonly id: string;
  readonly labId: string;

  /** Version identifier (e.g., "v1.0", "v1.1", "v2.0") */
  versao: string;

  /** Policy content as markdown */
  conteudo: string;

  /** Effective until date (null = current, active version) */
  dataEfetivaAte: Timestamp | null;

  readonly criadoEm: Timestamp;
  readonly deletadoEm?: Timestamp;
}

// ──────────────────────────────────────────────────────────────────────────
// User Privacy Policy Acceptance
// ──────────────────────────────────────────────────────────────────────────

export interface PrivacyAceite {
  readonly id: string;
  readonly labId: string;

  /** User ID who accepted */
  userId: string;

  /** Reference to PolicyVersion.id */
  policyVersionId: string;

  /** Policy version number for quick reference */
  policyVersao: string;

  /** Acceptance timestamp */
  aceiteEm: Timestamp;

  /** IP address of acceptance (for audit) */
  ipAddr: string;

  /** User Agent of acceptance (for audit) */
  userAgent: string;
}

// ──────────────────────────────────────────────────────────────────────────
// OTP (One-Time Password) for identity verification
// ──────────────────────────────────────────────────────────────────────────

export interface OTPRecord {
  readonly id: string;

  /** Email or contact method */
  contacto: string;

  /** 6-digit code */
  codigo: string;

  /** Expiration timestamp (10 minutes from creation) */
  expirasEm: Timestamp;

  /** Number of verification attempts */
  tentativas: number;

  /** Max attempts before lockout */
  tentativasMaximas: number;

  readonly criadoEm: Timestamp;
}

// ──────────────────────────────────────────────────────────────────────────
// PII Deletion Request (per LGPD Art. 18 — direito do titular)
// ──────────────────────────────────────────────────────────────────────────

export interface ExclusaoTitularRequest {
  readonly id: string;
  readonly labId: string;

  /** Masked CPF */
  cpf: string;

  /** Reason for deletion request */
  motivo: 'Exclusão solicitada pelo titular' | 'Fim da relação contratual' | 'Outro';

  /** Request status */
  status: 'pendente' | 'verificacao_otp' | 'confirmado' | 'processado';

  /** OTP verification token */
  otpToken?: string;

  readonly criadoEm: Timestamp;
  deletadoEm?: Timestamp;
}

// ──────────────────────────────────────────────────────────────────────────
// Audit Log for PII Deletion (separate from main audit trail)
// ──────────────────────────────────────────────────────────────────────────

export interface AuditLogPIIDeletion {
  readonly id: string;

  /** CPF hash of deleted titular */
  cpfHash: string;

  /** Number of documents modified */
  docCount: number;

  /** Deletion reason */
  motivo: string;

  /** Who requested the deletion (usually system/titular_self) */
  requestedBy: string;

  /** Completion timestamp */
  requestedAt: Timestamp;

  /** Completion status */
  status: 'completed' | 'failed' | 'partial';

  /** Chain hash for immutability proof */
  logicalSignature: LogicalSignature;
}
