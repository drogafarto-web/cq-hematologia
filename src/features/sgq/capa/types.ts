/**
 * CAPA Module Types
 *
 * Corrective/Preventive Action (CAPA) tracking per RDC 978 Art. 99 + DICQ 4.14.6
 * Schema: finding → action → verification → closeout
 * Multi-tenant path: /labs/{labId}/capa/{capaId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── CAPA Document (Root) ───────────────────────────────────────────────────

export type CAPAStatus = 'aberta' | 'em-tratamento' | 'verificada' | 'fechada' | 'cancelada';

export interface CAPA {
  readonly id: string;
  readonly labId: string;

  /** Short title of the finding */
  titulo: string;

  /** Detailed description of the deviation/finding */
  descricao: string;

  /**
   * Link to source finding (audit, laudo, complaint, risk).
   * Immutable once set — cannot reassign CAPA to different finding.
   */
  encontroId: string | null;

  /** Link to finding source type */
  encontroTipo?: 'auditoria' | 'laudo' | 'reclamacao' | 'risco' | 'nao-conformidade';

  /** Current status of CAPA */
  status: CAPAStatus;

  /** Priority level (1=lowest, 5=highest) */
  prioridade: 1 | 2 | 3 | 4 | 5;

  /** Target closure date */
  dataPrazo: Timestamp;

  /** When CAPA was created */
  readonly criadoEm: Timestamp;

  /** User who created CAPA */
  readonly criadoPor: string;

  /** Soft-delete fields */
  readonly deletadoEm: Timestamp | null;
  readonly deletadoPor: string | null;
}

// ─── CAPA Action (Subcollection) ─────────────────────────────────────────────

export type AcaoTipo = 'corretiva' | 'preventiva';
export type AcaoStatus = 'aberta' | 'concluida' | 'vencida';

export interface CAParecao {
  readonly id: string;
  readonly capaId: string;
  readonly labId: string;

  /** Action type: corrective or preventive */
  tipo: AcaoTipo;

  /** Description of the corrective/preventive action */
  descricao: string;

  /** User responsible for executing the action */
  responsavel: string;

  /** Due date for action completion */
  dataVencimento: Timestamp;

  /** Current status */
  status: AcaoStatus;

  /** Evidence files (links to PDF/storage) */
  evidenciasLinks: string[];

  /** Notes on action execution */
  notas?: string;

  /** When action was created */
  readonly criadoEm: Timestamp;

  /** When action was completed (status = concluida) */
  concluidaEm?: Timestamp;

  readonly deletadoEm: Timestamp | null;
}

// ─── Verification (Subcollection) ────────────────────────────────────────────

export type VerificacaoResultado = 'efetiva' | 'nao-efetiva' | 'parcialmente-efetiva';

export interface Verificacao {
  readonly id: string;
  readonly capaId: string;
  readonly labId: string;

  /** RT who performed verification */
  verificadoPor: string;

  /** Date of verification */
  dataVerificacao: Timestamp;

  /** Verification result */
  resultado: VerificacaoResultado;

  /** Verification notes */
  notas: string;

  /** Hours invested in investigation/correction (DICQ 4.14.2) */
  horasInvestidas?: number;

  /** When verification was recorded */
  readonly criadoEm: Timestamp;

  // Immutable once created — no updates allowed per Rules
  readonly deletadoEm: Timestamp | null;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export type CreateCAPAInput = Omit<
  CAPA,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm' | 'deletadoPor'
>;

export type CreateAcaoInput = Omit<
  CAParecao,
  'id' | 'capaId' | 'labId' | 'criadoEm' | 'concluidaEm' | 'deletadoEm'
>;

export type CreateVerificacaoInput = Omit<
  Verificacao,
  'id' | 'capaId' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

// ─── Status Transition Rules ─────────────────────────────────────────────────

export const VALID_STATUS_TRANSITIONS: Record<CAPAStatus, CAPAStatus[]> = {
  aberta: ['em-tratamento', 'cancelada'],
  'em-tratamento': ['verificada', 'cancelada'],
  verificada: ['fechada', 'cancelada'],
  fechada: [], // Terminal state
  cancelada: [], // Terminal state
};

export function isValidStatusTransition(
  currentStatus: CAPAStatus,
  newStatus: CAPAStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface CAPAFilters {
  status?: CAPAStatus;
  prioridade?: 1 | 2 | 3 | 4 | 5;
  encontroId?: string;
  criadoPor?: string;
  searchTerm?: string; // Searches titulo + descricao
}

export interface AcaoFilters {
  status?: AcaoStatus;
  responsavel?: string;
  tipo?: AcaoTipo;
}
