import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  CartesianGrid,
  Dot,
} from 'recharts';
import type { UseChartDataReturn, ChartPoint } from './hooks/useChartData';
import type { Analyte } from '../../types';
import { useTheme } from '../../shared/hooks/useTheme';

// ─── Custom dot ───────────────────────────────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}

function RunDot({ cx, cy, payload }: DotProps) {
  const { isDark } = useTheme();
  if (cx === undefined || cy === undefined || !payload) return null;

  const color =
    payload.isRejection   ? '#f87171' : // red-400
    payload.isWarningOnly ? '#fbbf24' : // amber-400
    payload.status === 'Aprovada' ? '#34d399' : // emerald-400
    (isDark ? '#94a3b8' : '#64748b'); // slate-400 (Pendente/no value)

  return (
    <g>
      {(payload.isRejection || payload.isWarningOnly) && (
        <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.15} />
      )}
      <circle
        cx={cx} cy={cy} r={4}
        fill={color}
        stroke={isDark ? '#0c0c0c' : '#ffffff'}
        strokeWidth={1.5}
      />
    </g>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  active?:  boolean;
  payload?: Array<{ payload: ChartPoint }>;
  analyte:  Analyte;
}

function CustomTooltip({ active, payload, analyte }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  if (p.value === null) return null;

  const ts = new Date(p.timestamp);
  const dateStr = ts.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const timeStr = ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const statusColor =
    p.isRejection   ? 'text-red-500 dark:text-red-400' :
    p.isWarningOnly ? 'text-amber-500 dark:text-amber-400' :
                      'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="rounded-xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/[0.1] px-4 py-3 shadow-xl text-xs transition-colors duration-300">
      <p className="text-slate-500 dark:text-white/40 mb-2">{dateStr} {timeStr}</p>
      <p className="text-slate-900 dark:text-white/90 font-semibold text-sm">
        {p.value.toFixed(analyte.decimals)} <span className="text-slate-400 dark:text-white/40 font-normal text-xs">{analyte.unit}</span>
      </p>
      {p.zScore !== null && (
        <p className="text-slate-500 dark:text-white/40 mt-0.5">
          z = {p.zScore > 0 ? '+' : ''}{p.zScore.toFixed(2)}
        </p>
      )}
      {p.violations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {p.violations.map((v) => (
            <span key={v} className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
              v === '1-2s' ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              {v}
            </span>
          ))}
        </div>
      )}
      <p className={`mt-1.5 font-medium ${statusColor}`}>{p.status}</p>
    </div>
  );
}

// ─── Reference line label ──────────────────────────────────────────────────────

interface RefLabelProps {
  viewBox?: { x?: number; y?: number; width?: number };
  text: string;
  color: string;
}

function RefLabel({ viewBox, text, color }: RefLabelProps) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 4;
  const y = (viewBox?.y ?? 0) - 4;
  return (
    <text x={x} y={y} textAnchor="end" fontSize={9} fill={color} opacity={0.7}>
      {text}
    </text>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LeveyJenningsChartProps {
  chartData:   UseChartDataReturn;
  analyte:     Analyte;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LeveyJenningsChart — Recharts-based control chart with Westgard reference lines.
 *
 * Reference lines:
 * ─── mean (white/60)
 * ─── ±1SD (green/40)
 * - - ±2SD (amber/50)
 * - - ±3SD (red/50)
 */
export function LeveyJenningsChart({ chartData, analyte }: LeveyJenningsChartProps) {
  const { chartData: data, currentStats: stats, westgardAlerts } = chartData;

  // Hooks devem ser chamados incondicionalmente, antes de qualquer early return
  const { isDark } = useTheme();

  if (!stats || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01] transition-colors duration-300">
        <p className="text-sm text-slate-400 dark:text-white/30">Sem dados para exibir</p>
        <p className="text-xs text-slate-300 dark:text-white/20 mt-1">Adicione corridas para gerar o gráfico</p>
      </div>
    );
  }

  // Y-axis domain: mean ± 3.5 SD with a bit of padding
  const yMin = stats.minus3sd - stats.sd * 0.5;
  const yMax = stats.plus3sd  + stats.sd * 0.5;

  // Recent alerts (last 5)
  const recentAlerts = [...westgardAlerts].slice(-5).reverse();

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01] p-4 pb-2 transition-colors duration-300">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white/80">{analyte.name}</span>
            <span className="text-xs text-slate-400 dark:text-white/30 ml-1.5">{analyte.unit}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 dark:text-white/40">
              x̄ = {stats.mean.toFixed(analyte.decimals)}
              {' · '}
              SD = {stats.sd.toFixed(analyte.decimals)}
              {' · '}
              CV = {stats.mean === 0 ? '—' : `${((stats.sd / stats.mean) * 100).toFixed(1)}%`}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 12, right: 30, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"}
              horizontal={true}
              vertical={false}
            />

            <XAxis
              dataKey="index"
              tick={{ fill: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)', fontSize: 10 }}
              axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(analyte.decimals)}
              width={48}
            />

            {/* Reference lines — ±3SD */}
            <ReferenceLine y={stats.plus3sd}  stroke="rgba(248,113,113,0.45)" strokeDasharray="4 3" label={<RefLabel text="+3s" color="#f87171" />} />
            <ReferenceLine y={stats.minus3sd} stroke="rgba(248,113,113,0.45)" strokeDasharray="4 3" label={<RefLabel text="-3s" color="#f87171" />} />

            {/* Reference lines — ±2SD */}
            <ReferenceLine y={stats.plus2sd}  stroke="rgba(251,191,36,0.40)"  strokeDasharray="5 3" label={<RefLabel text="+2s" color="#fbbf24" />} />
            <ReferenceLine y={stats.minus2sd} stroke="rgba(251,191,36,0.40)"  strokeDasharray="5 3" label={<RefLabel text="-2s" color="#fbbf24" />} />

            {/* Reference lines — ±1SD */}
            <ReferenceLine y={stats.plus1sd}  stroke="rgba(52,211,153,0.25)"  />
            <ReferenceLine y={stats.minus1sd} stroke="rgba(52,211,153,0.25)"  />

            {/* Mean */}
            <ReferenceLine y={stats.mean} stroke={isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"} strokeWidth={1.5} label={<RefLabel text="x̄" color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.6)"} />} />

            <Tooltip
              content={<CustomTooltip analyte={analyte} />}
              cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeWidth: 1 }}
            />

            <Line
              type="monotone"
              dataKey="value"
              stroke={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)"}
              strokeWidth={1.5}
              connectNulls={false}
              dot={(props) => <RunDot {...props} />}
              activeDot={{ r: 5, stroke: isDark ? '#0c0c0c' : '#ffffff', strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {[
          { color: 'bg-emerald-400', label: 'Aprovada' },
          { color: 'bg-amber-400',   label: 'Aviso 1-2s' },
          { color: 'bg-red-400',     label: 'Rejeitada' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-xs text-slate-400 dark:text-white/30">{label}</span>
          </div>
        ))}
      </div>

      {/* Westgard alerts panel */}
      {recentAlerts.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden transition-colors duration-300">
          <p className="text-xs font-semibold text-slate-500 dark:text-white/40 px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.05] uppercase tracking-wider">
            Alertas Westgard
          </p>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {recentAlerts.map((alert, i) => {
              const ts  = new Date(alert.timestamp);
              const date = ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    alert.violation === '1-2s'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {alert.violation}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-white/50">
                    Corrida #{alert.runIndex} — {alert.value.toFixed(analyte.decimals)} {analyte.unit}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-white/25 ml-auto">{date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
