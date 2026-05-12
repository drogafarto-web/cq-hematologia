/**
 * Tipos canônicos de `tipoKPI` em `kpi-metas` — alinhados ao callable `definirMetaKPI`
 * e aos agregados diários em `kpi-metrics`.
 */
export const KPI_META_TIPO_TURNAROUND = 'turnaround' as const;
export const KPI_META_TIPO_RETRABALHO = 'retrabalho' as const;
export const KPI_META_TIPO_DOCUMENTACAO = 'documentacao' as const;

export type KPIMetaTipoCanonico =
  | typeof KPI_META_TIPO_TURNAROUND
  | typeof KPI_META_TIPO_RETRABALHO
  | typeof KPI_META_TIPO_DOCUMENTACAO;
