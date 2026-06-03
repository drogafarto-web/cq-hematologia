/**
 * ADR 0004 — POP Versionado (Procedimentos Operacionais Padrão)
 *
 * Sistema de Procedimentos Operacionais Padrão com versionamento, assinatura
 * regulatória, treinamento obrigatório e integração com módulos de CIQ.
 *
 * Firestore path: /labs/{labId}/pops/{popId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── POPVersao (Immutable versioning) ──────────────────────────────────────

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

export interface POP {
  readonly id: string;
  readonly labId: string;

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

  modulos: string[];

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// ─── Training ─────────────────────────────────────────────────────────────

export interface TreinamentoPOP {
  popId: string;
  popVersaoNumero: string;
  dataConcluso: Timestamp;
  validoAte: Timestamp;
  certificado_url?: string;
}

// ─── Request/Response DTOs ────────────────────────────────────────────────

export type POPInput = Omit<
  POP,
  'id' | 'labId' | 'versoes' | 'criadoEm' | 'criadoPor' | 'deletadoEm'
>;

export interface POPCreationRequest {
  labId: string;
  nome: string;
  codigo: string;
  conteudo: { markdown?: string; pdfUrl?: string };
  treinamentosObrigatorios: Array<{
    modulo: string;
    tipoTreinamento: 'inicial' | 'reciclagem';
    periodicidadeMeses: number;
  }>;
  modulos: string[];
}

export interface POPVersionCreationRequest {
  labId: string;
  popId: string;
  conteudo: { markdown?: string; pdfUrl?: string };
  isMajorVersion?: boolean;
}

export interface POPSignatureRequest {
  labId: string;
  popId: string;
  popVersaoNumero: string;
}

export interface POPTrainingRequest {
  labId: string;
  operadorUid: string;
  popId: string;
  popVersaoNumero: string;
  certificado_url?: string;
}

export interface POPValidationResult {
  allowed: boolean;
  reason?: string;
  expiraEm?: Timestamp;
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface POPFilters {
  modulo?: string | string[];
  status?: 'ativa' | 'obsoleta' | 'em_revisao';
  busca?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function getVersaoAtiva(pop: POP): POPVersao | undefined {
  return pop.versoes.find((v) => v.status === 'ativa');
}

export function isVersaoExpirada(versao: POPVersao, now: Date = new Date()): boolean {
  return versao.dataVigenciaFim.toDate().getTime() < now.getTime();
}

export function isProximoVencimento(
  versao: POPVersao,
  now: Date = new Date(),
  diasLimite = 30,
): boolean {
  const diff = versao.dataVigenciaFim.toDate().getTime() - now.getTime();
  const diasAteVencer = diff / (1000 * 60 * 60 * 24);
  return diasAteVencer >= 0 && diasAteVencer <= diasLimite;
}

export function isTreinamentoValido(treino: TreinamentoPOP, now: Date = new Date()): boolean {
  return treino.validoAte.toDate().getTime() > now.getTime();
}
