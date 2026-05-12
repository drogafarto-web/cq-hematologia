/**
 * RiskDashboard — heatmap P×S, distribuição por nível e categoria, alertas de revisão.
 */

import React, { useMemo } from 'react';

import { useRiskReviewAlerts } from '../hooks/useRiskReviewAlerts';
import type { Categoria, Nivel, Risk } from '../types/Risk';
import { RiskHeatmap } from './RiskHeatmap';

const NIVEL_ORDER: readonly Nivel[] = ['baixo', 'medio', 'alto', 'critico'];
const NIVEL_LABEL: Record<Nivel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

const CATEGORIA_ORDER: readonly Categoria[] = [
  'analise',
  'equipamento',
  'material',
  'pessoal',
  'processo',
  'seguranca',
  'outro',
];

const CATEGORIA_LABEL: Record<Categoria, string> = {
  analise: 'Análise',
  equipamento: 'Equipamento',
  material: 'Material',
  pessoal: 'Pessoal',
  processo: 'Processo',
  seguranca: 'Segurança',
  outro: 'Outro',
};

export interface RiskDashboardProps {
  readonly risks: Risk[];
  readonly labId: string | null | undefined;
  readonly isLoadingRisks: boolean;
}

function BarRow(props: { label: string; value: number; max: number; tone: string }): React.ReactElement {
  const { label, value, max, tone } = props;
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 truncate text-white/60" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-200 ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-white/80">{value}</span>
    </div>
  );
}

export const RiskDashboard: React.FC<RiskDashboardProps> = ({
  risks,
  labId,
  isLoadingRisks,
}) => {
  const { vencidas, prestes, count, loading: loadingAlerts } = useRiskReviewAlerts(labId);

  const active = useMemo(
    () => risks.filter((r) => !r.deletadoEm && r.status !== 'fechado'),
    [risks],
  );

  const { byNivel, byCategoria, maxNivel, maxCat } = useMemo(() => {
    const n: Record<Nivel, number> = {
      baixo: 0,
      medio: 0,
      alto: 0,
      critico: 0,
    };
    const c: Record<Categoria, number> = {
      analise: 0,
      equipamento: 0,
      material: 0,
      pessoal: 0,
      processo: 0,
      seguranca: 0,
      outro: 0,
    };
    for (const r of active) {
      n[r.nivel] += 1;
      c[r.categoria] += 1;
    }
    const maxNivel = Math.max(...NIVEL_ORDER.map((k) => n[k]), 1);
    const maxCat = Math.max(...CATEGORIA_ORDER.map((k) => c[k]), 1);
    return { byNivel: n, byCategoria: c, maxNivel, maxCat };
  }, [active]);

  const nivelTones: Record<Nivel, string> = {
    baixo: 'bg-emerald-500/80',
    medio: 'bg-yellow-500/80',
    alto: 'bg-orange-500/80',
    critico: 'bg-red-500/80',
  };

  const catTone = 'bg-violet-500/80';

  return (
    <section className="border-b border-white/10 bg-[#141417] px-4 py-4" aria-labelledby="risk-dashboard-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="risk-dashboard-title" className="text-sm font-semibold text-white">
          Painel de distribuição
        </h2>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            vencidas.length > 0
              ? 'border-red-500/40 bg-red-500/15 text-red-200'
              : 'border-white/15 bg-white/5 text-white/70'
          }`}
          title={
            loadingAlerts
              ? 'Carregando alertas de revisão'
              : `${vencidas.length} vencida(s), ${prestes.length} próxima(s) em 7 dias`
          }
        >
          <span className="text-white/50">Revisões</span>
          <span className="tabular-nums font-semibold">
            {isLoadingRisks || loadingAlerts ? '—' : count}
          </span>
          {!loadingAlerts && vencidas.length > 0 && (
            <span className="text-[10px] uppercase tracking-wide text-red-300">vencidas</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskHeatmap risks={risks} />
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
              Por nível (NPR)
            </h3>
            <div className="space-y-2">
              {NIVEL_ORDER.map((nivel) => (
                <BarRow
                  key={nivel}
                  label={NIVEL_LABEL[nivel]}
                  value={byNivel[nivel]}
                  max={maxNivel}
                  tone={nivelTones[nivel]}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
              Por categoria
            </h3>
            <div className="space-y-2">
              {CATEGORIA_ORDER.map((cat) => (
                <BarRow
                  key={cat}
                  label={CATEGORIA_LABEL[cat]}
                  value={byCategoria[cat]}
                  max={maxCat}
                  tone={catTone}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
