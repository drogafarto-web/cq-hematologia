/**
 * CIQTrendsDash — Levey-Jennings composite chart for CIQ runs
 *
 * Displays a composite chart with:
 *   - Line: individual run values over time
 *   - Reference areas: ±2SD (warning) and ±3SD (control) bands
 *   - Reference lines: mean, ±2SD, ±3SD boundaries
 *   - Dot shape: emerald (valid) / red (out-of-control)
 *
 * Data comes from useChartData() which transforms the Zustand aggregate.
 * While real per-run time series isn't in the Phase 3.1 aggregate, this
 * component renders simulated observations to demonstrate the UI. When
 * Phase 3.2 wires real CIQ sub-collection data, only useChartData changes.
 */

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useChartData } from '../hooks/useChartData';
import { useAnalyticsLoading, useAnalyticsError } from '../hooks/useAnalyticsCache';
import { LJ_COLORS } from '../services/chartColorMap';
import { FilterUnavailableBanner } from './FilterUnavailableBanner';
import { shouldShowPartialFilterNotice, filterCapabilities } from '../utils/aggregateFilters';
import type { ChartDataPoint } from '../types/Analytics';

// ─── Custom dot ───────────────────────────────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}

function LJDot({ cx = 0, cy = 0, payload }: DotProps) {
  if (cx === undefined || cy === undefined) return null;
  const fill = payload?.isValid ? LJ_COLORS.pointValid : LJ_COLORS.pointInvalid;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={fill}
      stroke={fill}
      strokeWidth={1.5}
      strokeOpacity={0.4}
      fillOpacity={0.9}
    />
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function LJTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const valid = point.isValid;

  return (
    <div
      className="rounded-lg border border-white/10 bg-[#1c1c20] px-3 py-2.5 shadow-xl text-xs"
      role="tooltip"
    >
      <p className="text-white/50 mb-1.5">{label}</p>
      <p className="font-semibold tabular-nums text-white">Valor: {point.value.toFixed(3)}</p>
      <p className="text-white/50">Média: {point.mean.toFixed(3)}</p>
      <p className="text-white/50">
        z-score: {((point.value - point.mean) / ((point.upperWarning - point.mean) / 2)).toFixed(2)}
        σ
      </p>
      <p className={['mt-1.5 font-medium', valid ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
        {valid ? 'Conforme' : 'Não conforme'}
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="animate-pulse h-64 rounded-xl border border-white/8 bg-white/4 flex items-center justify-center">
      <div className="space-y-2 w-3/4">
        <div className="h-2 rounded bg-white/10 w-full" />
        <div className="h-2 rounded bg-white/8 w-4/5" />
        <div className="h-2 rounded bg-white/6 w-3/5" />
      </div>
    </div>
  );
}

// ─── Active filters ───────────────────────────────────────────────────────────

interface ActiveFilters {
  equipmentIds: Set<string>;
  operatorIds: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CIQTrendsDashProps {
  className?: string;
  activeFilters?: ActiveFilters;
}

export const CIQTrendsDash = React.memo(function CIQTrendsDash({
  className = '',
  activeFilters,
}: CIQTrendsDashProps) {
  const { ljChartData } = useChartData();
  const loading = useAnalyticsLoading();
  const error = useAnalyticsError();

  const equipmentIds = activeFilters?.equipmentIds ?? new Set<string>();
  const operatorIds = activeFilters?.operatorIds ?? new Set<string>();

  const showPartialNotice = shouldShowPartialFilterNotice('trends', equipmentIds, operatorIds);
  const partialReason = filterCapabilities('trends').reason;

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (equipmentIds.size > 0)
      parts.push(`${equipmentIds.size} equipamento${equipmentIds.size > 1 ? 's' : ''}`);
    if (operatorIds.size > 0)
      parts.push(`${operatorIds.size} operador${operatorIds.size > 1 ? 'es' : ''}`);
    return parts.join(', ');
  }, [equipmentIds, operatorIds]);

  // Compute reference values from the first data point (all share same ref)
  const ref = useMemo(() => {
    if (!ljChartData.length) return null;
    const p = ljChartData[0];
    return {
      mean: p.mean,
      upper2: p.upperWarning,
      lower2: p.lowerWarning,
      upper3: p.upperControl,
      lower3: p.lowerControl,
    };
  }, [ljChartData]);

  if (loading) return <ChartSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Falha ao carregar gráfico: {error}
      </div>
    );
  }

  if (!ljChartData.length) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/4 p-8 text-center text-sm text-white/30">
        Nenhuma corrida CIQ disponível para exibir tendências.
      </div>
    );
  }

  const invalidCount = ljChartData.filter((d) => !d.isValid).length;

  return (
    <section
      className={['space-y-4', className].join(' ')}
      aria-label="Tendências CIQ — Levey-Jennings"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
            Tendências CIQ
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            Levey-Jennings — últimas {ljChartData.length} corridas
          </p>
        </div>
        {invalidCount > 0 && (
          <div className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-xs text-red-400">
            {invalidCount} fora do controle
          </div>
        )}
      </div>

      {/* Partial filter notice — trends aggregate doesn't carry per-operator breakdown */}
      {showPartialNotice && (
        <FilterUnavailableBanner reason={partialReason} activeFilterLabel={activeFilterLabel} />
      )}

      {/* Chart */}
      <div className="w-full aspect-[4/3] md:aspect-[16/9] rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={ljChartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#ffffff40', fontSize: 10 }}
              axisLine={{ stroke: '#ffffff10' }}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fill: '#ffffff40', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={ref ? [ref.lower3 - 0.5, ref.upper3 + 0.5] : ['auto', 'auto']}
            />

            <Tooltip content={<LJTooltip />} />

            {/* Reference areas: ±2SD warning band */}
            {ref && (
              <>
                <ReferenceArea
                  y1={ref.lower2}
                  y2={ref.upper2}
                  fill={LJ_COLORS.warningBand}
                  ifOverflow="hidden"
                />
                {/* ±2SD lines */}
                <ReferenceLine
                  y={ref.upper2}
                  stroke={LJ_COLORS.warningLine}
                  strokeDasharray="4 2"
                  label={{ value: '+2SD', fill: '#f59e0b60', fontSize: 9, position: 'right' }}
                />
                <ReferenceLine
                  y={ref.lower2}
                  stroke={LJ_COLORS.warningLine}
                  strokeDasharray="4 2"
                  label={{ value: '-2SD', fill: '#f59e0b60', fontSize: 9, position: 'right' }}
                />
                {/* ±3SD lines */}
                <ReferenceLine
                  y={ref.upper3}
                  stroke={LJ_COLORS.controlLine}
                  strokeDasharray="2 3"
                  label={{ value: '+3SD', fill: '#ef444460', fontSize: 9, position: 'right' }}
                />
                <ReferenceLine
                  y={ref.lower3}
                  stroke={LJ_COLORS.controlLine}
                  strokeDasharray="2 3"
                  label={{ value: '-3SD', fill: '#ef444460', fontSize: 9, position: 'right' }}
                />
                {/* Mean line */}
                <ReferenceLine
                  y={ref.mean}
                  stroke={LJ_COLORS.mean}
                  strokeDasharray="6 2"
                  label={{ value: 'X̄', fill: '#ffffff80', fontSize: 10, position: 'right' }}
                />
              </>
            )}

            {/* Run values line */}
            <Line
              type="linear"
              dataKey="value"
              name="Valor"
              stroke={LJ_COLORS.line}
              strokeWidth={1.5}
              dot={(props) => <LJDot key={props.index} {...props} />}
              activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }}
              isAnimationActive={false}
            />

            {/* Bar: visual indicator of compliance per run */}
            <Bar
              dataKey="isValid"
              name="Status"
              hide
              // Data prop present for Legend only; not rendered
            />

            <Legend
              wrapperStyle={{ fontSize: 10, color: '#ffffff40', paddingTop: 8 }}
              iconSize={6}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend footnote */}
      <div className="flex items-center gap-4 text-xs text-white/30 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Conforme (dentro de ±2SD)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          Não conforme (além de ±2SD)
        </span>
      </div>
    </section>
  );
});
