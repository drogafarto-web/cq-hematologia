/**
 * ADR 0004 — POP Versionado (Procedimentos Operacionais Padrão)
 * Tipos para Firestore + Cloud Functions
 */

import type { Timestamp } from 'firebase/firestore';

// ─── POP Version ───────────────────────────────────────────────────────────

export interface POPVersao {
  numero: string;
  dataVigenciaInicio: Timestamp;
  dataVigenciaFim: Timestamp;
  hashConteudo: string;
  assinadaPor: {
    uid: string;
    nome: string;
    cargo: string;
    timestamp: Timestamp;
    hmac: string;
  };
  proximaRevisao: Timestamp;
  status: 'ativa' | 'obsoleta' | 'em_revisao';
  motivo_obsolescencia?: string;
}

// ─── POP Document ──────────────────────────────────────────────────────────

export interface POP {
  id: string;
  labId: string;
  nome: string;
  codigo: string;

  conteudo: {
    markdown?: string;
    pdfUrl?: string;
    versaoDocumento: string;
  };

  versoes: POPVersao[];

  treinamentosObrigatorios: Array<{
    modulo: string;
    tipoTreinamento: 'inicial' | 'reciclagem';
    periodicidadeMeses: number;
  }>;

  criadoEm: Timestamp;
  criadoPor: string;
  modulos: string[];
  deletadoEm: Timestamp | null;
}

// ─── Training Record ───────────────────────────────────────────────────────

export interface TreinamentoPOP {
  popId: string;
  popVersaoNumero: string;
  dataConcluso: Timestamp;
  validoAte: Timestamp;
  certificado_url?: string;
}

// ─── Input DTOs ────────────────────────────────────────────────────────────

export type POPInput = Omit<
  POP,
  'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'versoes' | 'deletadoEm'
>;

export interface POPVersionInput {
  markdown?: string;
  pdfUrl?: string;
}

// ─── Filter Types ──────────────────────────────────────────────────────────

export interface POPFilters {
  modulo?: string | string[];
  status?: boolean;
  busca?: string;
}

// ─── Cloud Function Results ────────────────────────────────────────────────

export interface CreatePOPResult {
  success: boolean;
  popId: string;
  codigo: string;
  mensagem: string;
}

export interface CreatePOPVersionResult {
  success: boolean;
  popId: string;
  versao: string;
  status: string;
  hashConteudo: string;
  mensagem: string;
}

export interface SignPOPVersionResult {
  success: boolean;
  popId: string;
  popVersaoNumero: string;
  status: string;
  assinadoPor: string;
  assinadoEm: Timestamp;
}

export interface RecordTreinamentoResult {
  success: boolean;
  operadorUid: string;
  popId: string;
  popVersaoNumero: string;
  validoAte: Date;
  certificado_url?: string;
  mensagem: string;
}
