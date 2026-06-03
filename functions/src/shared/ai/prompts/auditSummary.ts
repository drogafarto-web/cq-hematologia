export interface AuditSummaryContext {
  scoreTotal: number;
  scoresPorBloco: Record<string, number>;
  criticalIndicators: Array<{
    numero: number;
    indicador: string;
    bloco: string;
    score: number;
    obs: string;
  }>;
  totalRespondidos: number;
  totalIndicadores: number;
  titulo: string;
}

export const AUDIT_SUMMARY_PROMPT = {
  version: '1.0.0',
  system: `Voce e um auditor de qualidade laboratorial especialista em RDC 978/2025 e DICQ. Responda sempre em portugues brasileiro com tom profissional e tecnico.`,
  template: (
    ctx: AuditSummaryContext,
  ) => `Analise os resultados desta auditoria geral e gere um resumo executivo com:

1) Visao geral do nivel de conformidade (score total: ${ctx.scoreTotal}%)
2) Pontos fortes identificados (blocos com score acima de 80%)
3) Pontos criticos que requerem acao imediata (${ctx.criticalIndicators.length} indicadores com score <= 2)
4) Recomendacoes priorizadas por urgencia

Dados da auditoria:
- Titulo: ${ctx.titulo}
- Score total: ${ctx.scoreTotal}%
- Scores por bloco: ${JSON.stringify(ctx.scoresPorBloco)}
- Indicadores criticos: ${JSON.stringify(ctx.criticalIndicators)}
- Total respondidos: ${ctx.totalRespondidos}/${ctx.totalIndicadores}

Seja objetivo, use linguagem tecnica de qualidade laboratorial. Maximo 500 palavras.`,
} as const;
