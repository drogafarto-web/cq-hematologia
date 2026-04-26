/**
 * signatureCanonical.ts (server — insumoQualificacao)
 *
 * Espelha `canonicalQualificacao` do serviço client em
 * `src/features/insumos/services/insumoQualificacaoFirebaseService.ts`.
 *
 * Garantia: dado o mesmo payload, server e client produzem o MESMO SHA-256.
 * Trigger `onInsumoQualificacaoCreate` re-calcula com node:crypto e compara
 * com o `logicalSignature` gravado pelo cliente. Divergência ⇒ alerta
 * `signature_invalid` em /labs/{lab}/alertas/.
 */

import { createHash } from 'node:crypto';

export interface QualificacaoCanonicalPayload {
  qId: string;
  insumoId: string;
  produtoId: string;
  tipo: 'reagente' | 'controle';
  nivel?: 'positivo' | 'negativo';
  modulo: string;
  qualificacaoMode: 'corrida-validacao' | 'checklist-rt' | 'caracterizacao-rt';
  /** JSON.stringify do checklist (5 booleans). Será re-ordenado server-side. */
  checklist: string;
  evidenciaRunIds: string[];
  createdBy: string;
  clientCreatedAt: string;
}

export function canonicalQualificacao(p: QualificacaoCanonicalPayload): string {
  const sortedChecklist = JSON.parse(p.checklist) as Record<string, boolean>;
  const orderedChecklist: Record<string, boolean> = {};
  for (const k of Object.keys(sortedChecklist).sort()) {
    orderedChecklist[k] = sortedChecklist[k];
  }
  const ordered: Record<string, unknown> = {
    qId: p.qId,
    insumoId: p.insumoId,
    produtoId: p.produtoId,
    tipo: p.tipo,
    modulo: p.modulo,
    qualificacaoMode: p.qualificacaoMode,
    checklist: JSON.stringify(orderedChecklist),
    evidenciaRunIds: [...p.evidenciaRunIds].sort(),
    createdBy: p.createdBy,
    clientCreatedAt: p.clientCreatedAt,
  };
  if (p.nivel !== undefined) ordered.nivel = p.nivel;
  return JSON.stringify(ordered);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function computeQualificacaoSignature(
  p: QualificacaoCanonicalPayload,
): string {
  return sha256Hex(canonicalQualificacao(p));
}

// ─── Movimentação payload signature (tipo='qualificacao') ────────────────────
//
// Mesma forma das demais mov: ordem de chaves alinhada com client em
// `src/features/insumos/utils/movimentacaoSignature.ts`. Em decisões de
// qualificação carregamos `qualificacaoId` no canonical para selar o evento
// à decisão server.

export interface MovimentacaoQualificacaoPayload {
  movId: string;
  insumoId: string;
  tipo: 'qualificacao';
  operadorId: string;
  operadorName: string;
  clientTimestamp: string;
  decision: 'aprovado' | 'reprovado';
  qualificacaoId: string;
  motivoReprovacao?: string;
}

export function canonicalMovimentacaoQualificacao(
  p: MovimentacaoQualificacaoPayload,
): string {
  const ordered: Record<string, string> = {
    movId: p.movId,
    insumoId: p.insumoId,
    tipo: p.tipo,
    operadorId: p.operadorId,
    operadorName: p.operadorName,
    clientTimestamp: p.clientTimestamp,
    decision: p.decision,
    qualificacaoId: p.qualificacaoId,
  };
  if (p.motivoReprovacao !== undefined) ordered.motivoReprovacao = p.motivoReprovacao;
  return JSON.stringify(ordered);
}

export function computeMovimentacaoQualificacaoSignature(
  p: MovimentacaoQualificacaoPayload,
): string {
  return sha256Hex(canonicalMovimentacaoQualificacao(p));
}
