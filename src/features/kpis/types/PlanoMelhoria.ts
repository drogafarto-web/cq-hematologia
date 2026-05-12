/**
 * Planos de melhoria e ações — `/labs/{labId}/planos-melhoria/{planoId}` + subcoleção `acoes`.
 * @see `_meta/specs/indicadores-melhoria.spec.md`
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from '@/types';

export type PlanoMelhoriaStatus = 'rascunho' | 'ativo' | 'concluido' | 'cancelado';

export type AcaoMelhoriaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface PlanoMelhoria {
  readonly id: string;
  readonly labId: string;
  titulo: string;
  descricao: string;
  /** KPIAlert ou KPIDaily que originou o plano */
  kpiOrigemId?: string;
  status: PlanoMelhoriaStatus;
  responsavelId: string;
  responsavelNome: string;
  prazoMeta: Timestamp;
  conclusaoEm?: Timestamp;
  logicalSignature?: LogicalSignature;
  readonly criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm?: Timestamp;
}

export interface AcaoMelhoria {
  readonly id: string;
  readonly labId: string;
  planoId: string;
  descricao: string;
  responsavelId: string;
  responsavelNome: string;
  prazo: Timestamp;
  status: AcaoMelhoriaStatus;
  evidencia?: string;
  readonly criadoEm: Timestamp;
  updatedAt: Timestamp;
}
