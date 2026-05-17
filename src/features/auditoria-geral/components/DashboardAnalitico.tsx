import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useAuditoriasGeral } from '../hooks/useAuditoriasGeral';
import { BLOCOS } from '../data/blocos';
import type { AuditoriaGeral } from '../types';
import { QualificacaoAuditoresPanel } from './QualificacaoAuditoresPanel';

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#a78bfa';
  if (score >= 40) return '#fbbf24';
  return '#ef4444';
}

export function DashboardAnalitico() {
  const { auditorias, isLoading } = useAuditoriasGeral();

  const finalizadas = useMemo(
    () => auditorias.filter((a) => a.status === 'finalizada'),
    [auditorias],
  );

  const evolutionData = useMemo(() => {
    return [...finalizadas]
      .sort((a, b) => a.dataInicio.toMillis() - b.dataInicio.toMillis())
      .map((a) => ({
        date: a.dataInicio.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        score: a.scoreTotal,
        titulo: a.titulo,
      }));
  }, [finalizadas]);

  const ncDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    BLOCOS.forEach((b) => { counts[b.id] = 0; });
    finalizadas.forEach((a) => {
      Object.entries(a.scoresPorBloco).forEach(([bloco, score]) => {
        if (score <= 40) counts[bloco] = (counts[bloco] ?? 0) + 1;
      });
    });
    return BLOCOS.map((b) => ({ bloco: b.id, nome: b.nome, count: counts[b.id] ?? 0 }));
  }, [finalizadas]);

  const auditorPerformance = useMemo(() => {
    const map = new Map<string, { nome: string; count: number; totalScore: number }>();
    finalizadas.forEach((a) => {
      const existing = map.get(a.auditor.uid) ?? { nome: a.auditor.nome, count: 0, totalScore: 0 };
      existing.count += 1;
      existing.totalScore += a.scoreTotal;
      map.set(a.auditor.uid, existing);
    });
    return Array.from(map.entries()).map(([uid, data]) => ({
      uid,
      nome: data.nome,
      count: data.count,
      media: Math.round(data.totalScore / data.count),
    }));
  }, [finalizadas]);

  const blocoHeatmap = useMemo(() => {
    if (finalizadas.length === 0) return [];
    const sums: Record<string, { total: number; count: number }> = {};
    BLOCOS.forEach((b) => { sums[b.id] = { total: 0, count: 0 }; });
    finalizadas.forEach((a) => {
      Object.entries(a.scoresPorBloco).forEach(([bloco, score]) => {
        if (sums[bloco]) {
          sums[bloco].total += score;
          sums[bloco].count += 1;
        }
      });
    });
    return BLOCOS.map((b) => ({
      id: b.id,
      nome: b.nome,
      avg: sums[b.id].count > 0 ? Math.round(sums[b.id].total / sums[b.id].count) : 0,
    }));
  }, [finalizadas]);

  const sortedByDate = useMemo(() => {
    return [...finalizadas].sort((a, b) =>
      a.dataFim && b.dataFim ? a.dataFim.toMillis() - b.dataFim.toMillis() : 0
    );
  }, [finalizadas]);

  const emAndamento = useMemo(
    () => auditorias.filter((a) => a.status === 'em_andamento'),
    [auditorias],
  );

  const worstBlocks = useMemo(() => {
    const last = sortedByDate[sortedByDate.length - 1];
    if (!last) return [];
    return Object.entries(last.scoresPorBloco || {})
      .filter(([, score]) => typeof score === 'number')
      .sort(([, a], [, b]) => (a as number) - (b as number))
      .slice(0, 3);
  }, [sortedByDate]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8 px-4 max-w-3xl mx-auto" aria-busy="true">
        <div className="h-6 bg-slate-200 dark:bg-white/[0.06] rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-1/2 animate-pulse" />
        <div className="h-32 bg-slate-200 dark:bg-white/[0.06] rounded animate-pulse" />
      </div>
    );
  }

  const latest = sortedByDate[sortedByDate.length - 1] ?? null;
  const previous = sortedByDate.length > 1 ? sortedByDate[sortedByDate.length - 2] : null;
  const trend = latest && previous ? latest.scoreTotal - previous.scoreTotal : 0;

  const avgScore = finalizadas.length > 0
    ? Math.round(finalizadas.reduce((sum, a) => sum + a.scoreTotal, 0) / finalizadas.length)
    : 0;

  const lastAuditDate = latest?.dataFim?.toDate();
  const daysSinceLastAudit = lastAuditDate
    ? Math.floor((Date.now() - lastAuditDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (finalizadas.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 dark:text-white/40 text-sm">Nenhuma auditoria finalizada para exibir indicadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 px-4 max-w-6xl mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          value={`${latest!.scoreTotal}%`}
          label="Última Auditoria"
          sublabel={trend > 0 ? `+${trend}pp` : trend < 0 ? `${trend}pp` : '='}
          color={latest!.scoreTotal >= 70 ? 'emerald' : latest!.scoreTotal >= 50 ? 'amber' : 'red'}
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
          sublabel={daysSinceLastAudit && daysSinceLastAudit > 365 ? '> 1 ano' : 'dias'}
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
                      (score as number) >= 70 ? 'bg-emerald-400' : (score as number) >= 50 ? 'bg-amber-400' : 'bg-red-400'
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

      {/* Recommendations */}
      <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4">
        <h3 className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
          Recomendações ISO 15189
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
          {trend >= 0 && latest!.scoreTotal >= 80 && (
            <li>Score estável acima de 80% — manter programa de melhoria contínua</li>
          )}
          <li>Verificar eficácia das CAPAs abertas antes da próxima auditoria</li>
        </ul>
      </div>

      {/* Score Evolution */}
      <section className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-white/60 mb-4">Evolucao do Score</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={evolutionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              itemStyle={{ color: '#a78bfa' }}
            />
            <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* NC Distribution */}
      <section className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg p-6">
        <h2 className="text-sm font-medium text-slate-600 dark:text-white/60 mb-4">Distribuicao de NCs por Bloco</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ncDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="bloco" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {ncDistribution.map((entry, i) => (
                <Cell key={i} fill={entry.count > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auditor Performance */}
        <section className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg p-6">
          <h2 className="text-sm font-medium text-slate-600 dark:text-white/60 mb-4">Performance dos Auditores</h2>
          <div className="space-y-2">
            {auditorPerformance.map((a) => (
              <div key={a.uid} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/[0.04] last:border-0">
                <span className="text-sm text-slate-800 dark:text-white/80">{a.nome}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 dark:text-white/40 font-mono">{a.count} auditorias</span>
                  <span className={`text-sm font-mono font-medium ${a.media >= 70 ? 'text-emerald-400' : a.media >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {a.media}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bloco Heatmap */}
        <section className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg p-6">
          <h2 className="text-sm font-medium text-slate-600 dark:text-white/60 mb-4">Heatmap por Bloco</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {blocoHeatmap.map((b) => (
              <div
                key={b.id}
                className="rounded-lg p-3 text-center border border-slate-200 dark:border-white/[0.04]"
                style={{ backgroundColor: `${getScoreColor(b.avg)}15` }}
              >
                <p className="text-lg font-mono font-bold" style={{ color: getScoreColor(b.avg) }}>
                  {b.avg}%
                </p>
                <p className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5">Bloco {b.id}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Qualificacao de Auditores */}
      <QualificacaoAuditoresPanel auditorias={finalizadas} />
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
