/**
 * personnel/types/index.ts
 *
 * Tipos de domínio do módulo Personnel (Cargos + Designações).
 * Rastreabilidade: DICQ 5.1.3 (Descrição de Cargos) + DICQ 4.1.2.7 (GQ Designação).
 *
 * Multi-tenant: toda entidade carrega `labId` redundante no payload.
 * Assinatura: LogicalSignature = { hash, operatorId, ts } com hash SHA-256 (64 chars).
 */

import type { Timestamp } from '../../../shared/services/firebase';

// ─── Enums e tipos primitivos ──────────────────────────────────────────────────

export type RoleType =
  | 'tecnico'
  | 'enfermeiro'
  | 'farmaceutico'
  | 'analista'
  | 'gq' // Gerente de Qualidade
  | 'rt' // Responsável Técnico
  | 'diretor';

// ─── LogicalSignature ──────────────────────────────────────────────────────────

export interface LogicalSignature {
  readonly hash: string; // HMAC-SHA256 (64 chars hex)
  readonly operatorId: string; // request.auth.uid
  readonly ts: Timestamp;
}

// ─── Cargo (Job Description) ──────────────────────────────────────────────────

export interface Cargo {
  readonly id: string; // role slug: "tecnico", "gq", "rt", etc.
  readonly labId: string;
  readonly titulo: string; // "Técnico de Laboratório", "Gerente de Qualidade", etc.
  readonly descricao: string; // Full description with responsibilities
  readonly responsabilidades: readonly string[]; // Bullet points of duties
  readonly autoridades: readonly string[]; // Authority limits and decisions
  readonly certificacoes?: readonly string[]; // Required certifications (e.g., ["ABCLIN", "ISO15189"])
  readonly reportaA?: string; // Role this reports to (FK to Cargo.id)
  readonly criadoEm: Timestamp;
  readonly updatedAt: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type CargoInput = Omit<Cargo, 'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'>;

// ─── OrgChartNode (Hierarchy for visualization) ────────────────────────────

export interface OrgChartNode {
  cargoId: string; // Role ID
  designacaoId?: string; // Current occupant's designation ID
  nome?: string; // Current occupant's name
  titulo: string; // Role title
  reportaA?: string; // Parent node cargoId
  filhos?: OrgChartNode[]; // Child nodes (subordinates)
}

// ─── Designacao (Appointment with signature) ──────────────────────────────

export interface Designacao {
  readonly id: string; // UUID
  readonly labId: string;
  readonly cargoId: string; // FK to Cargo
  readonly pessoaId: string; // FK to staff member (from treinamentos)
  readonly pessoaNome: string; // Denormalized for display
  readonly dataInicio: Timestamp;
  readonly dataFim: Timestamp | null; // NULL = still in role
  readonly descricaoAutoridade: string; // What this person is authorized to do
  readonly successorId?: string; // Next person in line (FK to Designacao)
  readonly chainHash: LogicalSignature; // Signed by director/auditor
  readonly certificadoUrl?: string; // Download URL for certificate PDF
  readonly criadoEm: Timestamp;
  readonly updatedAt: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

export type DesignacaoInput = Omit<
  Designacao,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm' | 'chainHash'
>;

// ─── Inputs for Cloud Function signing ───────────────────────────────────────

export interface SignDesignacaoPayload {
  labId: string;
  cargoId: string;
  pessoaId: string;
  pessoaNome: string;
  dataInicio: number; // milliseconds (will be converted to Timestamp)
  dataFim?: number | null;
  descricaoAutoridade: string;
  successorId?: string;
}

export interface SignDesignacaoResult {
  designacaoId: string;
  signature: LogicalSignature;
  success: boolean;
}

// ─── Qualificacao (Operator certification/qualification) ──────────────────

export interface Qualificacao {
  readonly id: string; // UUID
  readonly labId: string;
  readonly uid: string; // FK to operator (from educacao-continuada)
  readonly tipo: 'Treinamento' | 'Capacitação' | 'Reciclagem'; // qualification type
  readonly modulosLiberados: readonly string[]; // modules where operator is authorized
  readonly validoDe: Timestamp;
  readonly validoAte: Timestamp | null; // NULL = indefinite
  readonly criadoEm: Timestamp;
  readonly deletadoEm: Timestamp | null; // RN-06: soft-delete only
}

export type QualificacaoInput = Omit<Qualificacao, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;

// ─── PersonnelDossier (REQ-403 — dossiê por colaborador) ─────────────────────

/** Documento: `/labs/{labId}/personnel/dossiers/{colaboradorId}` (id = Colaborador.id da educação continuada). */
export interface PersonnelDossier {
  readonly labId: string;
  readonly colaboradorId: string;
  readonly cvUrl: string | null;
  readonly cvResumo: string | null;
  readonly registroCRF: string | null;
  readonly registroCRBM: string | null;
  readonly registroCREF: string | null;
  readonly certificacoesNotas: string | null;
  readonly criadoEm: Timestamp;
  readonly updatedAt: Timestamp;
}

/** Campos editáveis no cliente (sem audit fields). Limites alinhados a `firestore.rules`. */
export type PersonnelDossierEditable = Pick<
  PersonnelDossier,
  'cvUrl' | 'cvResumo' | 'registroCRF' | 'registroCRBM' | 'registroCREF' | 'certificacoesNotas'
>;

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type LabId = string;
export type UserId = string;
