/**
 * RiskDashboard — Enterprise risk analytics panel.
 * KPI scorecards + heatmap + distribution charts + insights.
 */

import React, { useMemo } from 'react';

import { useRiskReviewAlerts } from '../hooks/useRiskReviewAlerts';
import type { Categoria, Nivel, Processo, Risk } from '../types/Risk';
import { RiskHeatmap } from './RiskHeatmap';

const NIVEL_ORDER: readonly Nivel[] = ['critico', 'alto', 'medio', 'baixo'];
const NIVEL_LABEL: Record<Nivel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};
const NIVEL_COLORS: Record<Nivel, { bar: string; badge: string }> = {
  critico: { bar: 'bg-red-500', badge: 'bg-red-500/15 text-red-300 border-red-500/30' },
  alto: { bar: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  medio: { bar: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  baixo: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
};

const PROCESSO_LABEL: Record<string, string> = {
  atendimento: 'Atendimento',
  coleta: 'Coleta',
  transporte: 'Transporte',
  armazenamento: 'Armazenamento',
  analise: 'Análise',
  pos_analitico: 'Pós-Analítico',
  liberacao: 'Liberação',
  administrativo: 'Administrativo',
  rastreabilidade: 'Rastreabilidade',
};

export interface RiskDashboardProps {
  readonly risks: Risk[];
  readonly labId: string | null | undefined;
  readonly isLoadingRisks: boolean;
}

function ScoreCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone: 'neutral' | 'danger' | 'warning' | 'success';
}) {
  const toneMap = {
    neutral: 'border-white/10 bg-white/[0.03]',
    danger: 'border-red-500/20 bg-red-500/[0.06]',
    warning: 'border-orange-500/20 bg-orange-500/[0.06]',
    success: 'border-emerald-500/20 bg-emerald-500/[0.06]',
  };
  const valueTone = {
    neutral: 'text-white',
    danger: 'text-red-400',
    warning: 'text-orange-400',
    success: 'text-emerald-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <div className={`text-2xl font-bold tabular-nums ${valueTone[tone]}`}>{value}</div>
      <div className="text-[11px] font-medium text-white/60 mt-1">{label}</div>
      {sublabel && <div className="text-[10px] text-white/40 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-[11px] text-white/60">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-[11px] tabular-nums font-medium text-white/70">
        {value}
      </span>
    </div>
  );
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({ risks, labId, isLoadingRisks }) => {
  const { vencidas, prestes, loading: loadingAlerts } = useRiskReviewAlerts(labId);

  const active = useMemo(
    () => risks.filter((r) => !r.deletadoEm && r.status !== 'fechado'),
    [risks],
  );

  const stats = useMemo(() => {
    const byNivel: Record<Nivel, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    const byProcesso: Record<string, number> = {};
    let totalNpr = 0;
    let mitigando = 0;

    for (const r of active) {
      byNivel[r.nivel] += 1;
      byProcesso[r.processo] = (byProcesso[r.processo] || 0) + 1;
      totalNpr += r.npr;
      if (r.status === 'mitigando') mitigando++;
    }

    const avgNpr = active.length > 0 ? Math.round(totalNpr / active.length) : 0;
    const maxProcesso = Math.max(...Object.values(byProcesso), 1);

    // Sort processos by count desc
    const processosSorted = Object.entries(byProcesso)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    // SGQ Score (0-100)
    const sgqFactors = {
      cobertura: active.length > 0 ? 1 : 0,
      mitigacao: active.length > 0 ? mitigando / active.length : 0,
      criticosControlados: byNivel.critico === 0 ? 1 : 0.3,
      revisoes: vencidas.length === 0 ? 1 : 0.5,
    };
    const sgqScore = Math.round(
      sgqFactors.cobertura * 20 +
        sgqFactors.mitigacao * 30 +
        sgqFactors.criticosControlados * 30 +
        sgqFactors.revisoes * 20,
    );

    return { byNivel, byProcesso, processosSorted, maxProcesso, avgNpr, mitigando, sgqScore };
  }, [active, vencidas]);

  const sgqLabel =
    stats.sgqScore >= 80
      ? 'Avançado'
      : stats.sgqScore >= 60
        ? 'Intermediário'
        : stats.sgqScore >= 40
          ? 'Básico'
          : 'Crítico';
  const sgqTone =
    stats.sgqScore >= 80
      ? 'success'
      : stats.sgqScore >= 60
        ? 'neutral'
        : stats.sgqScore >= 40
          ? 'warning'
          : 'danger';

  const loading = isLoadingRisks || loadingAlerts;

  return (
    <section
      className="border-b border-white/[0.06] bg-[#0d0d10] px-4 py-5"
      aria-labelledby="risk-dashboard-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 id="risk-dashboard-title" className="text-sm font-semibold text-white">
          Painel Executivo de Riscos
        </h2>
        {vencidas.length > 0 && !loading && (
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[11px] font-medium text-red-300">
              {vencidas.length} revisão(ões) vencida(s)
            </span>
          </div>
        )}
      </div>

      {/* KPI Scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <ScoreCard label="Riscos Ativos" value={loading ? '—' : active.length} tone="neutral" />
        <ScoreCard
          label="Críticos"
          value={loading ? '—' : stats.byNivel.critico}
          sublabel={stats.byNivel.critico > 0 ? 'Ação imediata' : 'Nenhum'}
          tone={stats.byNivel.critico > 0 ? 'danger' : 'success'}
        />
        <ScoreCard
          label="Alto Risco"
          value={loading ? '—' : stats.byNivel.alto}
          tone={stats.byNivel.alto > 0 ? 'warning' : 'neutral'}
        />
        <ScoreCard
          label="Em Mitigação"
          value={loading ? '—' : stats.mitigando}
          sublabel={
            active.length > 0
              ? `${Math.round((stats.mitigando / active.length) * 100)}% do total`
              : undefined
          }
          tone="neutral"
        />
        <ScoreCard
          label="NPR Médio"
          value={loading ? '—' : stats.avgNpr}
          sublabel="P×S×D médio"
          tone={stats.avgNpr > 40 ? 'warning' : 'neutral'}
        />
        <ScoreCard
          label="Score SGQ"
          value={loading ? '—' : `${stats.sgqScore}%`}
          sublabel={sgqLabel}
          tone={sgqTone as any}
        />
      </div>

      {/* Main content: Heatmap + Analytics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RiskHeatmap risks={risks} />

        <div className="space-y-4">
          {/* Distribution by Nivel */}
          <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
              Distribuição por Nível
            </h3>
            <div className="space-y-2.5">
              {NIVEL_ORDER.map((nivel) => (
                <MiniBar
                  key={nivel}
                  label={NIVEL_LABEL[nivel]}
                  value={stats.byNivel[nivel]}
                  max={Math.max(...Object.values(stats.byNivel), 1)}
                  color={NIVEL_COLORS[nivel].bar}
                />
              ))}
            </div>
          </div>

          {/* Distribution by Processo (Pareto) */}
          <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
              Concentração por Processo
            </h3>
            <div className="space-y-2.5">
              {stats.processosSorted.map(([proc, count]) => (
                <MiniBar
                  key={proc}
                  label={PROCESSO_LABEL[proc] || proc}
                  value={count}
                  max={stats.maxProcesso}
                  color="bg-violet-500"
                />
              ))}
            </div>
          </div>

          {/* Insights */}
          {!loading && active.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                Insights Automáticos
              </h3>
              <ul className="space-y-1.5 text-[11px] text-white/70">
                {stats.byNivel.critico > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span>
                      {stats.byNivel.critico} risco(s) em nível crítico requerem ação imediata
                    </span>
                  </li>
                )}
                {vencidas.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                    <span>
                      {vencidas.length} revisão(ões) periódica(s) vencida(s) — RDC 978 Art. 109
                    </span>
                  </li>
                )}
                {prestes.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    <span>{prestes.length} revisão(ões) vencem nos próximos 7 dias</span>
                  </li>
                )}
                {stats.processosSorted.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span>
                      Maior concentração:{' '}
                      {PROCESSO_LABEL[stats.processosSorted[0][0]] || stats.processosSorted[0][0]} (
                      {stats.processosSorted[0][1]} riscos)
                    </span>
                  </li>
                )}
                {stats.mitigando === 0 && active.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>Nenhum risco em mitigação ativa — considere iniciar tratamento</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
