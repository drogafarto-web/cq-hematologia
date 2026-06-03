import { useAuditoriasGeral } from '../hooks/useAuditoriasGeral';
import { useAchados } from '../hooks/useAchados';
import type { AuditoriaGeral } from '../types';

export function AnaliseCriticaPanel() {
  const { auditorias, isLoading } = useAuditoriasGeral();

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-white/[0.06] rounded w-1/3" />
        <div className="h-24 bg-slate-200 dark:bg-white/[0.06] rounded" />
      </div>
    );
  }

  const finalizadas = auditorias.filter((a) => a.status === 'finalizada');
  const emAndamento = auditorias.filter((a) => a.status === 'em_andamento');

  if (finalizadas.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500 dark:text-white/50">
          Nenhuma auditoria finalizada para análise crítica
        </p>
        <p className="text-xs text-slate-400 dark:text-white/30 mt-1">
          Finalize ao menos uma auditoria para visualizar indicadores de gestão
        </p>
      </div>
    );
  }

  // Calculate trends
  const sortedByDate = [...finalizadas].sort((a, b) =>
    a.dataFim && b.dataFim ? a.dataFim.toMillis() - b.dataFim.toMillis() : 0,
  );
  const latest = sortedByDate[sortedByDate.length - 1];
  const previous = sortedByDate.length > 1 ? sortedByDate[sortedByDate.length - 2] : null;
  const trend = previous ? latest.scoreTotal - previous.scoreTotal : 0;

  // Average score over time
  const avgScore = Math.round(
    finalizadas.reduce((sum, a) => sum + a.scoreTotal, 0) / finalizadas.length,
  );

  // Frequency analysis
  const lastAuditDate = latest.dataFim?.toDate();
  const daysSinceLastAudit = lastAuditDate
    ? Math.floor((Date.now() - lastAuditDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Worst blocks (lowest scores in latest audit)
  const worstBlocks = Object.entries(latest.scoresPorBloco || {})
    .filter(([, score]) => typeof score === 'number')
    .sort(([, a], [, b]) => (a as number) - (b as number))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white/90">
          Análise Crítica pela Gestão
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/40 mt-1">
          Visão consolidada para entrada na análise crítica conforme ISO 15189 s8.9
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          value={`${latest.scoreTotal}%`}
          label="Última Auditoria"
          sublabel={trend > 0 ? `+${trend}pp` : trend < 0 ? `${trend}pp` : '='}
          color={latest.scoreTotal >= 70 ? 'emerald' : latest.scoreTotal >= 50 ? 'amber' : 'red'}
        />
        <KpiCard
          value={`${avgScore}%`}
          label="Média Histórica"
          sublabel={`${finalizadas.length} auditorias`}
          color="violet"
        />
        <KpiCard
          value={String(daysSinceLastAudit ?? '—')}
          label="Dias desde última"
          sublabel={daysSinceLastAudit && daysSinceLastAudit > 365 ? '⚠ > 1 ano' : 'dias'}
          color={daysSinceLastAudit && daysSinceLastAudit > 365 ? 'red' : 'slate'}
        />
        <KpiCard
          value={String(emAndamento.length)}
          label="Em Andamento"
          sublabel="auditorias"
          color="violet"
        />
      </div>

      {/* Worst blocks */}
      {worstBlocks.length > 0 && (
        <div className="bg-white border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg p-4">
          <h3 className="text-xs font-medium text-slate-600 dark:text-white/60 mb-3">
            Blocos com Menor Conformidade (última auditoria)
          </h3>
          <div className="space-y-2">
            {worstBlocks.map(([bloco, score]) => (
              <div key={bloco} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-white/50">
                  {bloco}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (score as number) >= 70
                        ? 'bg-emerald-400'
                        : (score as number) >= 50
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-600 dark:text-white/60 w-10 text-right">
                  {score as number}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend over time */}
      {finalizadas.length >= 2 && (
        <div className="bg-white border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg p-4">
          <h3 className="text-xs font-medium text-slate-600 dark:text-white/60 mb-3">
            Evolução do Score
          </h3>
          <div className="flex items-end gap-1 h-20">
            {sortedByDate.slice(-8).map((a, i) => (
              <div key={a.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-violet-400 dark:bg-violet-500 min-h-[4px]"
                  style={{ height: `${(a.scoreTotal / 100) * 64}px` }}
                  title={`${a.scoreTotal}% — ${a.dataFim?.toDate().toLocaleDateString('pt-BR') ?? ''}`}
                />
                <span className="text-[8px] text-slate-400 dark:text-white/30">
                  {a.dataFim?.toDate().toLocaleDateString('pt-BR', { month: 'short' }) ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4">
        <h3 className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
          Recomendações para Análise Crítica
        </h3>
        <ul className="text-xs text-amber-700/80 dark:text-amber-400/70 space-y-1 list-disc list-inside">
          {daysSinceLastAudit && daysSinceLastAudit > 330 && (
            <li>DICQ requer auditoria anual — agendar próxima auditoria</li>
          )}
          {worstBlocks.length > 0 && (worstBlocks[0][1] as number) < 50 && (
            <li>Bloco {worstBlocks[0][0]} com score abaixo de 50% — priorizar ações corretivas</li>
          )}
          {trend < 0 && (
            <li>Score em queda ({trend}pp) — investigar causas e reforçar treinamentos</li>
          )}
          {trend >= 0 && latest.scoreTotal >= 80 && (
            <li>Score estável acima de 80% — manter programa de melhoria contínua</li>
          )}
          <li>Verificar eficácia das CAPAs abertas antes da próxima auditoria</li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({
  value,
  label,
  sublabel,
  color,
}: {
  value: string;
  label: string;
  sublabel: string;
  color: 'emerald' | 'amber' | 'red' | 'violet' | 'slate';
}) {
  const colorMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    violet: 'text-violet-600 dark:text-violet-400',
    slate: 'text-slate-700 dark:text-white/80',
  };

  return (
    <div className="bg-white border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg p-4">
      <p className={`text-2xl font-bold font-mono tabular-nums ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">{label}</p>
      <p className="text-[10px] text-slate-400 dark:text-white/30">{sublabel}</p>
    </div>
  );
}
