/**
 * ADR 0004 — Auditoria Interna (ISO 15189:2012 cl. 4.14)
 *
 * Sistema de auditorias internas com geração automática de não-conformidades
 * a partir de achados graves. Auditores registram achados, que podem ser
 * consolidados em NCs com bloqueios automáticos.
 *
 * Firestore path: /labs/{labId}/auditorias/{auditoriaId}
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Achado (Finding) ─────────────────────────────────────────────────────

export type SeveridadeAchado = 'critica' | 'grave' | 'moderada' | 'leve' | 'observacao';

export interface Achado {
  id: string;
  descricao: string;
  severidade: SeveridadeAchado;
  criterio: string; // Qual DICQ / norma foi violada
  evidencias?: string[]; // URLs de fotos/documentos
  ncGerada?: string; // ID da NC criada a partir deste achado
  readonly registradoEm: Timestamp;
  readonly registradoPor: string;
}

// ─── Plano de Ação ────────────────────────────────────────────────────────

export type PlanoAcaoStatus = 'nao_iniciado' | 'em_execucao' | 'fechado' | 'vencido';

export interface PlanoAcao {
  auditoriaId: string;
  achadoId: string;
  descricao: string;
  responsavel: string;
  prazo: Timestamp;
  evidencia?: string;
  status: PlanoAcaoStatus;
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  concluídoEm?: Timestamp;
}

// ─── Main Auditoria Entity ────────────────────────────────────────────────

export interface Auditoria {
  readonly id: string;
  readonly labId: string;

  codigo: string;
  titulo: string;
  tipo: 'interna' | 'externa' | 'auditoria_cliente';
  escopo: string; // Ex: "Módulo de Hematologia"

  // Checklist
  checklist?: {
    totalItens: number;
    itensConforme: number;
    itensNaoConforme: number;
    itensNA: number;
  };

  // Achados e plano de ação
  achados: Achado[];
  planosAcao: PlanoAcao[];

  // Datas
  readonly agendadaPara: Timestamp;
  readonly realizadaEm: Timestamp;
  readonly realizadaPor: string;
  readonly realizadaPorName: string;
  prazoClosure?: Timestamp;

  status: 'planejada' | 'em_execucao' | 'finalizada' | 'fechada';
  observacoes?: string;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  deletadoEm: Timestamp | null;
}

// ─── Request/Response DTOs ────────────────────────────────────────────────

export type AuditoriaInput = Omit<
  Auditoria,
  | 'id'
  | 'labId'
  | 'achados'
  | 'planosAcao'
  | 'realizadaEm'
  | 'realizadaPor'
  | 'realizadaPorName'
  | 'criadoEm'
  | 'criadoPor'
  | 'deletadoEm'
>;

export interface AuditoriaCreationRequest {
  labId: string;
  codigo: string;
  titulo: string;
  tipo: 'interna' | 'externa' | 'auditoria_cliente';
  escopo: string;
  agendadaPara: Timestamp;
}

export interface AchadoRegistrationRequest {
  labId: string;
  auditoriaId: string;
  descricao: string;
  severidade: SeveridadeAchado;
  criterio: string;
  evidencias?: string[];
}

export interface PlanoAcaoCreationRequest {
  labId: string;
  auditoriaId: string;
  achadoId: string;
  descricao: string;
  responsavel: string;
  prazo: Timestamp;
}

// ─── Filters ──────────────────────────────────────────────────────────────

export interface AuditoriaFilters {
  status?: 'planejada' | 'em_execucao' | 'finalizada' | 'fechada';
  tipo?: 'interna' | 'externa' | 'auditoria_cliente';
  busca?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function temAchadosGraves(auditoria: Auditoria): boolean {
  return auditoria.achados.some((a) => a.severidade === 'critica' || a.severidade === 'grave');
}

export function contaAchadosPorSeveridade(
  auditoria: Auditoria,
  severidade: SeveridadeAchado,
): number {
  return auditoria.achados.filter((a) => a.severidade === severidade).length;
}

export function statusProgressoPlanoAcao(auditoria: Auditoria): {
  total: number;
  fechados: number;
  percentual: number;
} {
  const total = auditoria.planosAcao.length;
  const fechados = auditoria.planosAcao.filter((p) => p.status === 'fechado').length;
  return {
    total,
    fechados,
    percentual: total === 0 ? 0 : Math.round((fechados / total) * 100),
  };
}

export function diasAteVencimento(
  auditoria: Auditoria,
  now: Date = new Date(),
): number | null {
  if (!auditoria.prazoClosure) return null;
  const diff = auditoria.prazoClosure.toDate().getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
