/**
 * Meta numérica por tipo de KPI — documento em `/labs/{labId}/kpi-metas/{metaId}`.
 * @see `_meta/specs/indicadores-melhoria.spec.md`
 */

import type { Timestamp } from 'firebase/firestore';

/** Unidade da meta conforme spec (percentual, horas ou contagem absoluta). */
export type KPIMetaUnidade = 'percent' | 'hours' | 'count';

export interface KPIMeta {
  readonly id: string;
  readonly labId: string;
  tipoKPI: string;
  valor: number;
  unidade: KPIMetaUnidade;
  vigenciaInicio: Timestamp;
  vigenciaFim?: Timestamp;
  definidoPor: string;
  definidoPorNome: string;
  readonly criadoEm: Timestamp;
  ativo: boolean;
}
