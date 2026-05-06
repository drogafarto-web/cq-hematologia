import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataResult, ChartPoint } from '../hooks/useChartData';
import { WestgardViolation } from '../utils/westgardRulesCLSI';

interface LeveyJenningsChartProps {
  data: ChartDataResult;
  analitoName: string;
  nivelName: string;
  onPointClick?: (point: ChartPoint) => void;
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LeveyJenningsChart: React.FC<LeveyJenningsChartProps> = ({
  data,
  analitoName,
  nivelName,
  onPointClick,
}) => {
  const reducedMotion = prefersReducedMotion();

  // Transform chart points for Recharts
  const chartData = useMemo(() => {
    return data.points.map((p) => ({
      x: p.capturaEm.toMillis(),
      y: p.value,
      runId: p.runId,
      zScore: p.zScore.toFixed(2),
      violations: p.violations,
      hasViolation: p.violations.length > 0,
      isReject: p.violations.some((v) => v.severity === 'reject'),
      isWarn: p.violations.some((v) => v.severity === 'warn'),
    }));
  }, [data.points]);

  if (data.points.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-64 bg-slate-900/30 rounded-lg border border-slate-700">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Sem dados de runs para este analito</p>
          <p className="text-xs text-slate-500 mt-1">{analitoName} - {nivelName}</p>
        </div>
      </div>
    );
  }

  const getPointColor = (point: any) => {
    if (point.isReject) return '#ef4444'; // red
    if (point.isWarn) return '#eab308'; // amber
    return '#10b981'; // green
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-200">
          {analitoName} - {nivelName}
        </h3>
        <div className="text-xs text-slate-500">
          Fonte: {data.statsSource === 'manufacturer' ? 'Bula do Fabricante' : 'Estatística Interna'} · N={data.points.length}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 60 }}
          data={chartData}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            dataKey="x"
            name="Data"
            tickFormatter={(ts) => new Date(ts).toLocaleDateString('pt-BR')}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Valor"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            width={60}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />

          {/* Reference lines: ±3σ, ±2σ, ±1σ, mean */}
          <ReferenceLine
            y={data.mean}
            stroke="#6366f1"
            strokeWidth={2}
            name="Média"
            label={{ value: 'μ', position: 'right' as const, fill: '#6366f1', fontSize: 12 }}
          />
          <ReferenceLine
            y={data.mean + data.sd}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{ value: '+1σ', position: 'right' as const, fill: '#10b981', fontSize: 10 }}
          />
          <ReferenceLine
            y={data.mean - data.sd}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="5 5"
            label={{ value: '-1σ', position: 'right' as const, fill: '#10b981', fontSize: 10 }}
          />
          <ReferenceLine
            y={data.mean + 2 * data.sd}
            stroke="#eab308"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            label={{ value: '+2σ', position: 'right' as const, fill: '#eab308', fontSize: 10 }}
          />
          <ReferenceLine
            y={data.mean - 2 * data.sd}
            stroke="#eab308"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            label={{ value: '-2σ', position: 'right' as const, fill: '#eab308', fontSize: 10 }}
          />
          <ReferenceLine
            y={data.mean + 3 * data.sd}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="3 3"
            label={{ value: '+3σ', position: 'right' as const, fill: '#ef4444', fontSize: 10 }}
          />
          <ReferenceLine
            y={data.mean - 3 * data.sd}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="3 3"
            label={{ value: '-3σ', position: 'right' as const, fill: '#ef4444', fontSize: 10 }}
          />

          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
            }}
            labelFormatter={(value) => new Date(value as number).toLocaleString('pt-BR')}
          />

          <Scatter
            name="Resultados"
            data={chartData}
            fill="#10b981"
            onClick={(state: any) => {
              const point = data.points.find((p) => p.runId === state.payload.runId);
              if (point) onPointClick?.(point);
            }}
          >
            {chartData.map((point, index) => (
              <Scatter
                key={index}
                data={[point]}
                fill={getPointColor(point)}
                shape="circle"
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LeveyJenningsChart;
