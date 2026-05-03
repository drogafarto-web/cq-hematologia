/**
 * Módulo: Treinamentos (RH + Compliance)
 *
 * Sistema de registro de treinamentos com vínculo obrigatório a:
 * - POPs (Procedimentos Operacionais Padrão — ADR 0004)
 * - Qualificações de operadores (ADR 0006)
 * - Certificados com assinatura
 *
 * Firestore path: /labs/{labId}/treinamentos/{treinamentoId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Tipos ────────────────────────────────────────────────────────────────

export type TipoTreinamento = 'inicial' | 'reciclagem' | 'complementar';
export type StatusTreinamento = 'planejado' | 'agendado' | 'realizado' | 'cancelado';

export const TIPO_LABEL: Record<TipoTreinamento, string> = {
  inicial: 'Inicial',
  reciclagem: 'Reciclagem',
  complementar: 'Complementar',
};

export const STATUS_LABEL: Record<StatusTreinamento, string> = {
  planejado: 'Planejado',
  agendado: 'Agendado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

// ─── Entity ───────────────────────────────────────────────────────────────

export interface Treinamento {
  readonly id: string;
  readonly labId: string;

  // Vínculo obrigatório a POP
  popId: string;
  popVersaoNumero: string;
  popNome: string;

  tipo: TipoTreinamento;
  titulo: string;
  descricao?: string;

  // Cronograma
  dataAgendada: Timestamp;
  dataRealizacao?: Timestamp;
  duracao_minutos: number; // Duração esperada

  // Instrutor
  instrutorId: string;
  instrutorNome: string;

  // Participantes
  participantes: string[]; // Array de uids
  presenca: Record<string, { presente: boolean; assinatura?: string }>;

  // Qualificações geradas
  certificado?: {
    numero: string;
    emitidoEm: Timestamp;
    validoAte: Timestamp;
    url?: string;
  };

  status: StatusTreinamento;
  motivoCancelamento?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// ─── Request/Response ─────────────────────────────────────────────────────

export type TreinamentoInput = Omit<
  Treinamento,
  | 'id'
  | 'labId'
  | 'presenca'
  | 'criadoEm'
  | 'criadoPor'
  | 'deletadoEm'
  | 'dataRealizacao'
  | 'certificado'
>;

export interface TreinamentoCreationRequest {
  labId: string;
  popId: string;
  popVersaoNumero: string;
  tipo: TipoTreinamento;
  titulo: string;
  dataAgendada: Timestamp;
  instrutorId: string;
  duracao_minutos: number;
  participantes: string[];
}

export interface RegistroPresencaRequest {
  labId: string;
  treinamentoId: string;
  participanteId: string;
  presente: boolean;
  assinatura?: string;
}

export interface EmitirCertificadoRequest {
  labId: string;
  treinamentoId: string;
  validadesMeses: number;
  certificadoUrl?: string;
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface TreinamentoFilters {
  tipo?: TipoTreinamento;
  status?: StatusTreinamento;
  popId?: string;
  instrutorId?: string;
  participanteId?: string;
  dataApos?: Timestamp;
  dataAntes?: Timestamp;
  busca?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function isTreinamentoPendente(t: Treinamento): boolean {
  return t.status === 'planejado' || t.status === 'agendado';
}

export function isTreinamentoRealizado(t: Treinamento): boolean {
  return t.status === 'realizado' && !!t.certificado;
}

export function diasAteVencimentoCertificado(
  t: Treinamento,
  now: Date = new Date(),
): number | null {
  if (!t.certificado?.validoAte) return null;
  const diff = t.certificado.validoAte.toDate().getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function calcularFrequencia(t: Treinamento): {
  total: number;
  presentes: number;
  percentual: number;
} {
  const total = t.participantes.length;
  const presentes = Object.values(t.presenca).filter((p) => p.presente).length;
  return {
    total,
    presentes,
    percentual: total === 0 ? 0 : Math.round((presentes / total) * 100),
  };
}
