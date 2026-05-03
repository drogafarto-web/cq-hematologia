/**
 * ADR 0003 — Não-Conformidade (NC) + CAPA (Corrective Action)
 *
 * Sistema de gestão de não-conformidades com workflow CAPA integrado.
 * Não-conformidades podem ser abertas por qualquer módulo (hematologia, coagulação, etc)
 * e bloqueiam operações baseado em severidade.
 *
 * Firestore path: /labs/{labId}/naoConformidades/{ncId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Severity ─────────────────────────────────────────────────────────────

export type Severidade = 'critica' | 'grave' | 'moderada' | 'leve';

export const SEVERIDADE_LABEL: Record<Severidade, string> = {
  critica: 'Crítica',
  grave: 'Grave',
  moderada: 'Moderada',
  leve: 'Leve',
};

export const SEVERIDADE_CORES: Record<Severidade, string> = {
  critica: 'bg-red-600',
  grave: 'bg-red-500',
  moderada: 'bg-amber-500',
  leve: 'bg-blue-500',
};

// ─── CAPA Status ──────────────────────────────────────────────────────────

export type CAPAStatus =
  | 'nao_iniciada'
  | 'investigacao'
  | 'acao'
  | 'eficacia'
  | 'fechada'
  | 'reaberta';

export const CAPA_STATUS_LABEL: Record<CAPAStatus, string> = {
  nao_iniciada: 'Não iniciada',
  investigacao: 'Em investigação',
  acao: 'Ação corretiva',
  eficacia: 'Verificação de eficácia',
  fechada: 'Fechada',
  reaberta: 'Reabertura',
};

// ─── Main NC Entity ───────────────────────────────────────────────────────

export interface NaoConformidade {
  readonly id: string;
  readonly labId: string;

  codigo: string;
  titulo: string;
  descricao: string;
  severidade: Severidade;

  // Origem da NC
  origem: 'auditoria' | 'modulo' | 'cliente' | 'interno';
  moduloOrigem?: string; // ex: 'hematologia'
  auditoriaId?: string; // Se origem='auditoria'

  // Bloqueios
  bloqueiaOperacoes: boolean; // true se severidade >= 'grave'
  modulosBloqueados?: string[]; // Quais módulos estão bloqueados

  // CAPA Workflow
  capaStatus: CAPAStatus;
  capaHistorico: CAPAEvent[];

  // Datas
  readonly abertaEm: Timestamp;
  readonly abertaPor: string;
  prazoClosure?: Timestamp;
  readonly fechadaEm?: Timestamp;
  readonly fechadaPor?: string;

  deletadoEm: Timestamp | null;
}

export interface CAPAEvent {
  status: CAPAStatus;
  timestamp: Timestamp;
  realizadoPor: string;
  realizadoPorName: string;
  descricao?: string;
  evidencias?: string[]; // URLs para documentos de evidência
}

// ─── Request/Response DTOs ────────────────────────────────────────────────

export type NCInput = Omit<
  NaoConformidade,
  | 'id'
  | 'labId'
  | 'codigo'
  | 'capaStatus'
  | 'capaHistorico'
  | 'abertaEm'
  | 'abertaPor'
  | 'fechadaEm'
  | 'fechadaPor'
  | 'deletadoEm'
>;

export interface NCCreationRequest {
  labId: string;
  titulo: string;
  descricao: string;
  severidade: Severidade;
  origem: 'auditoria' | 'modulo' | 'cliente' | 'interno';
  moduloOrigem?: string;
  auditoriaId?: string;
  prazoClosure?: Timestamp;
}

export interface CAPAProgressRequest {
  labId: string;
  ncId: string;
  novoStatus: CAPAStatus;
  descricao?: string;
  evidencias?: string[];
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface NCFilters {
  severidade?: Severidade | Severidade[];
  capaStatus?: CAPAStatus | CAPAStatus[];
  origem?: string;
  bloqueiaOperacoes?: boolean;
  busca?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function isBloqueada(nc: NaoConformidade): boolean {
  return nc.severidade === 'critica' || nc.severidade === 'grave';
}

export function getProximoStatusCAPAValido(currentStatus: CAPAStatus): CAPAStatus[] {
  const transitions: Record<CAPAStatus, CAPAStatus[]> = {
    nao_iniciada: ['investigacao'],
    investigacao: ['acao'],
    acao: ['eficacia'],
    eficacia: ['fechada', 'reaberta'],
    fechada: ['reaberta'],
    reaberta: ['investigacao'],
  };
  return transitions[currentStatus] || [];
}

export function isCAPACompleta(nc: NaoConformidade): boolean {
  return nc.capaStatus === 'fechada';
}

export function diasAteVencimento(
  nc: NaoConformidade,
  now: Date = new Date(),
): number | null {
  if (!nc.prazoClosure) return null;
  const diff = nc.prazoClosure.toDate().getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
