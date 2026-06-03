/**
 * LGPD Data Protection Types
 *
 * LGPD Lei 13.709/18 (Arts. 7, 8, 9, 11, 18) compliance framework.
 * Handles: consent, data access requests, deletion requests, audit logging.
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from './reclamacao';

/** LGPD legal basis for processing */
export type BaseLegal =
  | 'obrigacao-legal' // legal requirement (RDC 978 retention)
  | 'consentimento' // explicit consent
  | 'legitimo-interesse'; // legitimate interest (service improvement)

/** Data subject request types (Art. 18) */
export type TipoLgpdRequest =
  | 'acessar-dados' // export my data
  | 'retificar-dados' // correct my data
  | 'excluir-dados' // delete my data (anonimization)
  | 'portabilidade'; // data portability

export type StatusLgpdRequest = 'pendente' | 'processando' | 'concluido' | 'rejeitado';

/** LGPD data access request (Art. 18) */
export interface LgpdRequest {
  // ─── Identity ────────────────────────────────────────────────────────────
  id: string;
  labId: string;
  pacienteId: string; // who is making the request

  // ─── Request Details ────────────────────────────────────────────────────
  tipo: TipoLgpdRequest;
  descricao?: string; // optional user message
  status: StatusLgpdRequest;
  motivoRejeicao?: string; // if rejected

  // ─── Processing ─────────────────────────────────────────────────────────
  criadoEm: Timestamp;
  processadoEm?: Timestamp;
  processadoPor?: string; // admin userId
  prazoDias: number; // 15 dias úteis standard

  // ─── Delivery ───────────────────────────────────────────────────────────
  exportUrl?: string; // Cloud Storage link (expires in 7 days)
  exportFormatosDisponiveis: ('json' | 'csv' | 'pdf')[]; // default ['json', 'pdf']
  downloadedEm?: Timestamp;

  // ─── Audit Trail ────────────────────────────────────────────────────────
  signature: LogicalSignature;
  deletadoEm?: Timestamp | null;
}

/** LGPD audit log — every operation on PII is logged */
export interface LgpdAuditLog {
  id: string;
  labId: string;
  pacienteId?: string; // null if system-level operation

  // ─── Operation Details ──────────────────────────────────────────────────
  acao: 'ler' | 'escrever' | 'deletar' | 'anonimizar' | 'exportar';
  recurso: string; // 'reclamacoes', 'satisfacao-respostas', 'sugestoes', etc.
  documentoId?: string; // which document
  operadoPor: string; // userId (system = 'SYSTEM_CRON')

  // ─── Justification ──────────────────────────────────────────────────────
  motivo: string; // why was this operation performed?
  baseLegal?: BaseLegal;

  // ─── Details (redacted for privacy) ──────────────────────────────────────
  dadosAfetados: {
    campos: string[]; // which fields were touched
    quantidadeRegistros: number;
    hash?: string; // anonymized hash of data affected (for audit)
  };

  // ─── Timestamp ───────────────────────────────────────────────────────────
  em: Timestamp;
}

/** Anonymized data record — PII is removed but stats are preserved */
export interface ReclamacaoAnonimizada {
  id: string;
  labId: string;

  // ─── Anonymized Identifiers ─────────────────────────────────────────────
  // PII removed, but links for trending/stats preserved
  pacienteCpfHash?: string; // one-way hash (not reversible)
  pacienteIdHash?: string;

  // ─── Content (PII filtered) ────────────────────────────────────────────
  descricao: string; // "*** redacted ***" or filtered version
  comunicacoes: {
    tipo: string;
    conteudo: string; // anonymized
    em: Timestamp;
  }[];

  // ─── Classification / Analysis (preserved) ──────────────────────────────
  tipo: string;
  severidade: string;
  area: string;
  status: string;

  // ─── Timeline (preserved) ──────────────────────────────────────────────
  recebidoEm: Timestamp;
  resolvidoEm?: Timestamp;
  slaPrazo: Timestamp;

  // ─── RCA (preserved) ───────────────────────────────────────────────────
  rca?: {
    problema: string;
    porques: { nivel: number; pergunta: string; resposta: string }[];
    causaRaiz: string;
  };

  // ─── Audit ──────────────────────────────────────────────────────────────
  anonimizadoEm: Timestamp;
  anonimizadoPor: string; // userId or 'SYSTEM_CRON'
  retencaoAte: Timestamp; // 5 years from RDC 978
}

/** NPS response anonymization (after 90 days, drops pacienteId) */
export interface NPSRespostaAnonimizada {
  id: string;
  labId: string;

  // ─── Original fields (preserved) ─────────────────────────────────────────
  origem: string;
  nota: number;
  categoria: string;
  respondidoEm: Timestamp;

  // ─── PII removed ────────────────────────────────────────────────────────
  pacienteId?: null; // explicitly null after anonymization
  cpfHash?: null; // explicitly null

  // ─── Optional feedback (may have PII) ────────────────────────────────────
  comentario?: string; // redacted if contained PII
  comentarioOriginalHash?: string; // for integrity checking

  // ─── Anonymization ──────────────────────────────────────────────────────
  anonimizadoEm: Timestamp;
  anonimizadoPor: string;
  retencaoAte: Timestamp; // 5 years from RDC 978
}

/** Export format for Art. 18 data portability */
export interface DadosPacienteLgpd {
  // ─── Header ─────────────────────────────────────────────────────────────
  pacienteId: string;
  dataExportacao: Timestamp;
  laboratorio: {
    nome: string;
    cnpj: string;
  };

  // ─── Complaint History ──────────────────────────────────────────────────
  reclamacoes: {
    total: number;
    porStatus: Record<string, number>;
    registros: any[]; // full complaint objects (with signature)
  };

  // ─── NPS Responses ──────────────────────────────────────────────────────
  npsRespostas: {
    total: number;
    mediaNota: number;
    registros: any[];
  };

  // ─── Suggestions ────────────────────────────────────────────────────────
  sugestoes: {
    total: number;
    porStatus: Record<string, number>;
    registros: any[];
  };

  // ─── LGPD Requests ──────────────────────────────────────────────────────
  lgpdRequests: {
    total: number;
    registros: any[];
  };

  // ─── Audit Trail ────────────────────────────────────────────────────────
  auditLogExcerpts: {
    totalOperacoes: number;
    ultimasOperacoes: LgpdAuditLog[]; // last 20
  };

  // ─── Signature ──────────────────────────────────────────────────────────
  signature: LogicalSignature;
}

export type CreateLgpdRequestInput = Omit<
  LgpdRequest,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'status' | 'exportUrl'
>;

export type CreateLgpdAuditLogInput = Omit<LgpdAuditLog, 'id' | 'labId' | 'em'>;
