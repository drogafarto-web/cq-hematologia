import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { URO_ANALITOS, URO_ANALITO_LABELS } from '../UroAnalyteConfig';
import { avaliarRunUro } from '../hooks/useUroValidator';
import { useTheme } from '../../../shared/hooks/useTheme';
import type { UroanaliseRun } from '../types/Uroanalise';
import type { UroAnalitoId } from '../types/_shared_refs';

// ─── Props ────────────────────────────────────────────────────────────────────

interface UroHitRateChartProps {
  runs: UroanaliseRun[];
}

interface ChartRow {
  analyte: UroAnalitoId;
  label: string;
  taxa: number; // % aprovação
  total: number; // corridas que tinham valor para esse analito
  nc: number; // corridas não conformes
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] px-3.5 py-2.5 shadow-xl text-xs">
      <p className="font-semibold text-slate-800 dark:text-white/85 mb-1">{r.label}</p>
      <p className="text-slate-500 dark:text-white/50 font-mono">{r.taxa.toFixed(1)}% aprovação</p>
      <p className="text-slate-400 dark:text-white/35 text-[11px] mt-0.5">
        {r.total - r.nc} de {r.total} conformes
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UroHitRateChart — hit-rate de conformidade por analito para um conjunto de runs.
 *
 * Renderiza um BarChart horizontal ordenado ascendentemente por taxa de aprovação
 * (analito mais problemático no topo). Útil no dashboard para identificar
 * rapidamente qual parâmetro da tira está gerando mais NCs.
 */
export function UroHitRateChart({ runs }: UroHitRateChartProps) {
  const { isDark } = useTheme();

  const data = useMemo<ChartRow[]>(() => {
    const rows: ChartRow[] = URO_ANALITOS.map((id) => {
      // Corridas que tinham valor para esse analito (não-null)
      let total = 0;
      let nc = 0;
      for (const run of runs) {
        const field = run.resultados[id];
        if (!field || field.valor === null || field.valor === undefined) continue;
        total++;
        const avaliacao = avaliarRunUro(run);
        if (avaliacao.conformidadePorAnalito[id] === false) nc++;
      }
      const taxa = total > 0 ? ((total - nc) / total) * 100 : 100;
      return { analyte: id, label: URO_ANALITO_LABELS[id], taxa, total, nc };
    });

    // Ordena ascendentemente (menor taxa = mais problemático, no topo)
    return rows.sort((a, b) => a.taxa - b.taxa);
  }, [runs]);

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01]">
        <p className="text-sm text-slate-400 dark:text-white/30">
          Sem dados para calcular taxa de conformidade
        </p>
      </div>
    );
  }

  const barColor = (taxa: number): string => {
    if (taxa >= 95) return '#34d399'; // emerald-400
    if (taxa >= 85) return '#fbbf24'; // amber-400
    return '#f87171'; // red-400
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01] p-4 pb-2">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white/80">
          Hit-rate de conformidade por analito
        </p>
        <p className="text-xs text-slate-400 dark:text-white/35">
          {runs.length} corrida{runs.length !== 1 ? 's' : ''}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, URO_ANALITOS.length * 24)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, left: 0, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.45)', fontSize: 10 }}
            axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={100}
            tick={{ fill: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.65)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }}
          />
          <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
            {data.map((row, idx) => (
              <BarCell
                key={row.analyte}
                fill={barColor(row.taxa)}
                index={idx}
                total={data.length}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarCell({ fill }: { fill: string; index: number; total: number }) {
  return <Cell fill={fill} />;
}
