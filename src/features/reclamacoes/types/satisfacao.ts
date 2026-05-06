/**
 * Satisfacao Domain Types
 *
 * NPS (Net Promoter Score) survey system per DICQ 4.14.3.
 * Two triggers: post-complaint resolution + recurring quarterly.
 * Multi-tenant: `/labs/{labId}/satisfacao-respostas/`
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from './reclamacao';

/** NPS score categorization */
export type NPSCategoria = 'detrator' | 'neutro' | 'promotor';

/** NPS survey origin */
export type OrigemNPS = 'pos-resolucao' | 'recurring-trimestral';

/** Quarterly campaign metadata */
export interface CampanhaSatisfacao {
  id: string;
  labId: string;
  trimestre: string;      // '2026-Q1', '2026-Q2', etc.
  dataInicio: Timestamp;
  dataFim: Timestamp;
  quantidadeConvidados: number;
  quantidadeRespostas: number;
  npsResultado: number;   // average (0-100)
  status: 'ativa' | 'encerrada' | 'processando';
}

/** Single NPS survey response */
export interface NPSResposta {
  // ─── Identity ────────────────────────────────────────────────────────────
  id: string;
  labId: string;

  // ─── Patient / Respondent (anonymized after 90 days) ──────────────────
  pacienteId?: string;    // null after anonymization
  cpfHash?: string;       // anonymized identifier (not PII)

  // ─── Origin ──────────────────────────────────────────────────────────────
  origem: OrigemNPS;
  reclamacaoId?: string;  // if pos-resolucao, which complaint
  trimestreRecurring?: string; // if recurring-trimestral, which quarter

  // ─── Response ────────────────────────────────────────────────────────────
  nota: number;           // 0-10
  categoria: NPSCategoria; // computed from nota
  comentario?: string;    // optional free-form feedback

  // ─── Metadata ────────────────────────────────────────────────────────────
  respondidoEm: Timestamp;
  ipHash: string;         // anti-spam, non-PII hash
  userAgent?: string;     // device info (optional)

  // ─── Privacy ─────────────────────────────────────────────────────────────
  anonimizadoEm?: Timestamp; // after 90 days
  piiMask?: boolean;      // if comentario had PII that was redacted

  // ─── Audit Trail ────────────────────────────────────────────────────────
  signature?: LogicalSignature;
  criadoEm: Timestamp;
  deletadoEm?: Timestamp | null;
}

/** ─── Campaign scheduling ──────────────────────────────────────────────────── */

export interface CampanhaTrimestralConfig {
  labId: string;
  diasDoMes: number[];    // e.g., [15] = 15th of each target month
  meses: number[];        // e.g., [1, 4, 7, 10] = Q1, Q2, Q3, Q4
  diasUteisIgnorar: boolean; // if true, skip weekends/holidays
  diasAntecipados: number; // days before to send invitation
}

export type CreateNPSRespostaInput = Omit<
  NPSResposta,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'cpfHash' | 'categoria' | 'anonimizadoEm'
>;

export type UpdateNPSRespostaInput = Partial<
  Omit<NPSResposta, 'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'respondidoEm'>
>;

export type CreateCampanhaSatisfacaoInput = Omit<
  CampanhaSatisfacao,
  'id' | 'labId' | 'quantidadeRespostas' | 'npsResultado'
>;
