import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  EquipamentoMonitorado,
  LeituraTemperatura,
} from '../types/ControlTemperatura';

export interface GraficoTemperaturaProps {
  equipamento: EquipamentoMonitorado;
  leituras: LeituraTemperatura[];
  height?: number;
}

/**
 * Linha histórica com banda de aceitabilidade. Pontos fora dos limites
 * ficam destacados em rose — a banda emerald-100 dá leitura rápida de
 * conformidade sem precisar cruzar com a legenda.
 */
export function GraficoTemperatura({ equipamento, leituras, height = 280 }: GraficoTemperaturaProps) {
  const data = useMemo(() => {
    return [...leituras]
      .filter((l) => l.deletadoEm === null)
      .sort((a, b) => a.dataHora.toMillis() - b.dataHora.toMillis())
      .map((l) => ({
        ts: l.dataHora.toMillis(),
        data: l.dataHora.toDate().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        temperatura: l.temperaturaAtual,
        fora: l.foraDosLimites,
      }));
  }, [leituras]);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Sem leituras no período para {equipamento.nome}.
      </div>
    );
  }

  const min = equipamento.limites.temperaturaMin;
  const max = equipamento.limites.temperaturaMax;
  const margem = Math.max(1, (max - min) * 0.25);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis
            domain={[min - margem, max + margem]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            unit="°C"
          />
          <ReferenceArea y1={min} y2={max} fill="#d1fae5" fillOpacity={0.45} />
          <ReferenceLine y={max} stroke="#059669" strokeDasharray="4 4" />
          <ReferenceLine y={min} stroke="#059669" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: unknown) => [`${Number(v).toFixed(1)} °C`, 'Temperatura']}
          />
          <Line
            type="monotone"
            dataKey="temperatura"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { fora: boolean } };
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={payload.fora ? 5 : 3}
                  fill={payload.fora ? '#e11d48' : '#4f46e5'}
                  stroke="#fff"
                  strokeWidth={1}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
