/**
 * NCHeatmapDash — Non-conformity heatmap by module and age
 *
 * Renders a CSS grid heatmap: rows = modules, columns = age buckets.
 * Cell color intensity encodes NC count (0 = transparent, 1 = saturated red).
 *
 * Also shows an age distribution bar chart (Recharts BarChart) for the
 * aggregate NC age breakdown across all modules.
 *
 * Design: no heavy Recharts Treemap (less readable for this data shape);
 * custom CSS grid heatmap is cleaner, more scannable.
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAnalyticsAggregate, useAnalyticsLoading, useAnalyticsError } from '../hooks/useAnalyticsCache';
import { useChartData } from '../hooks/useChartData';
import { heatmapCellColor } from '../services/chartColorMap';
import type { NCHeatmapCell } from '../types/Analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

const AGE_BUCKETS: Array<NCHeatmapCell['ageBucket']> = ['7d', '30d', '60d', '>60d'];
const BUCKET_LABELS: Record<NCHeatmapCell['ageBucket'], string> = {
  '7d':   '≤ 7 dias',
  '30d':  '8–30 dias',
  '60d':  '31–60 dias',
  '>60d': '> 60 dias',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeatmapSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-2">
          <div className="h-8 w-24 rounded bg-white/6" />
          {[...Array(4)].map((__, j) => (
            <div key={j} className="h-8 flex-1 rounded bg-white/4" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1c1c20] px-3 py-2 shadow-xl text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      <p className="font-semibold text-white">{payload[0].value} NCs</p>
    </div>
  );
}

// ─── Active filters ───────────────────────────────────────────────────────────

interface ActiveFilters {
  equipmentIds: Set<string>;
  operatorIds: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NCHeatmapDashProps {
  className?: string;
  activeFilters?: ActiveFilters;
}

export const NCHeatmapDash = React.memo(function NCHeatmapDash({
  className = '',
  activeFilters: _activeFilters,
}: NCHeatmapDashProps) {
  const aggregate = useAnalyticsAggregate();
  const loading = useAnalyticsLoading();
  const error = useAnalyticsError();
  const { ncAgeDist, heatmapCells } = useChartData();

  // Group cells by module for rendering rows
  const moduleRows = useMemo(() => {
    const map = new Map<string, { label: string; cells: Map<string, NCHeatmapCell> }>();
    for (const cell of heatmapCells) {
      if (!map.has(cell.moduleSlug)) {
        map.set(cell.moduleSlug, { label: cell.moduleLabel, cells: new Map() });
      }
      map.get(cell.moduleSlug)!.cells.set(cell.ageBucket, cell);
    }
    return Array.from(map.entries());
  }, [heatmapCells]);

  if (loading) {
    return (
      <section className={['space-y-4', className].join(' ')} aria-label="Heatmap de NCs">
        <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
        <HeatmapSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Falha ao carregar heatmap de NCs: {error}
      </div>
    );
  }

  const totalOpen = aggregate?.openNCs ?? 0;

  return (
    <section
      className={['space-y-5', className].join(' ')}
      aria-label="Não-conformidades por módulo e idade"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
            NCs por Módulo
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            {totalOpen} NCs abertas · distribuição por tempo de abertura
          </p>
        </div>
        {totalOpen === 0 && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
            Zero NCs abertas
          </span>
        )}
      </div>

      {/* Age distribution bar chart */}
      {ncAgeDist.length > 0 && totalOpen > 0 && (
        <div className="w-full aspect-[4/3] md:aspect-[16/9] rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs text-white/40 mb-3">Distribuição por idade</p>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={ncAgeDist} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" horizontal={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#ffffff40', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#ffffff40', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="value" name="NCs" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {ncAgeDist.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heatmap grid */}
      {moduleRows.length > 0 ? (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          {/* Column headers */}
          <div
            className="grid border-b border-white/8 bg-white/[0.02]"
            style={{ gridTemplateColumns: '7rem repeat(4, 1fr)' }}
          >
            <div className="px-3 py-2 text-xs text-white/30">Módulo</div>
            {AGE_BUCKETS.map((bucket) => (
              <div key={bucket} className="px-2 py-2 text-xs text-white/40 text-center">
                {BUCKET_LABELS[bucket]}
              </div>
            ))}
          </div>

          {/* Module rows */}
          <div className="divide-y divide-white/5">
            {moduleRows.map(([slug, { label, cells }]) => (
              <div
                key={slug}
                className="grid hover:bg-white/[0.015] transition-colors"
                style={{ gridTemplateColumns: '7rem repeat(4, 1fr)' }}
                role="row"
              >
                {/* Module label */}
                <div className="px-3 py-2.5 flex items-center" role="rowheader">
                  <span className="text-xs text-white/60 truncate">{label}</span>
                </div>

                {/* Cells */}
                {AGE_BUCKETS.map((bucket) => {
                  const cell = cells.get(bucket);
                  const count = cell?.count ?? 0;
                  const intensity = cell?.intensity ?? 0;
                  const bg = heatmapCellColor(intensity);

                  return (
                    <div
                      key={bucket}
                      className="relative flex items-center justify-center py-2.5 text-xs tabular-nums"
                      style={{ background: bg }}
                      role="gridcell"
                      aria-label={`${label} — ${BUCKET_LABELS[bucket]}: ${count} NCs`}
                      title={`${label} · ${BUCKET_LABELS[bucket]}: ${count} NCs`}
                    >
                      {count > 0 ? (
                        <span
                          className={[
                            'font-semibold',
                            intensity > 0.5 ? 'text-white' : 'text-white/60',
                          ].join(' ')}
                        >
                          {count}
                        </span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-white/30">
          {totalOpen === 0
            ? 'Nenhuma NC aberta. Ótimo trabalho!'
            : 'Sem dados de NC por módulo disponíveis.'}
        </div>
      )}
    </section>
  );
});
