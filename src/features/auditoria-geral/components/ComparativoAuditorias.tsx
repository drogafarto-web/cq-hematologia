import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

import type { AuditoriaGeral, BlocoId } from '../types';

const BLOCO_NAMES: Record<BlocoId, string> = {
  A: 'Doc. Legal',
  B: 'Contratos',
  C: 'Equipamentos',
  D: 'Risco/Docs',
  E: 'Pessoal',
  F: 'Infraestrutura',
  G: 'Sistemas/Bio',
  H: 'Procedimentos',
  I: 'Pre-Analitica',
  J: 'Analitica',
  K: 'Pos-Analitica',
  L: 'CIQ/CEQ',
};

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

interface Props {
  auditorias: AuditoriaGeral[];
}

export function ComparativoAuditorias({ auditorias }: Props) {
  const finalizadas = useMemo(
    () =>
      auditorias
        .filter((a) => a.status === 'finalizada')
        .sort((a, b) => {
          const ta = a.dataInicio?.toDate?.()?.getTime() ?? 0;
          const tb = b.dataInicio?.toDate?.()?.getTime() ?? 0;
          return ta - tb;
        }),
    [auditorias],
  );

  const lineData = useMemo(
    () =>
      finalizadas.map((a) => ({
        name: a.dataInicio?.toDate?.()
          ? a.dataInicio.toDate().toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          : a.titulo,
        score: a.scoreTotal,
        titulo: a.titulo,
      })),
    [finalizadas],
  );

  const radarData = useMemo(() => {
    const blocos = Object.keys(BLOCO_NAMES) as BlocoId[];
    return blocos.map((bloco) => {
      const entry: Record<string, string | number> = { bloco: BLOCO_NAMES[bloco] };
      finalizadas.slice(-3).forEach((a, i) => {
        entry[`audit${i}`] = a.scoresPorBloco?.[bloco] ?? 0;
      });
      return entry;
    });
  }, [finalizadas]);

  if (finalizadas.length < 2) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-500 dark:text-white/50">
          Necessario ao menos 2 auditorias finalizadas para comparativo.
        </p>
      </div>
    );
  }

  const recentForRadar = finalizadas.slice(-3);

  return (
    <div className="space-y-8">
      <div className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.08] rounded-lg p-6">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white/90 mb-4">
          Evolucao do Score Geral
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e1e22',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                formatter={(value) => [`${value}%`, 'Score']}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.08] rounded-lg p-6">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white/90 mb-4">
          Comparativo por Bloco (ultimas 3)
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="bloco"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
                axisLine={false}
              />
              {recentForRadar.map((a, i) => (
                <Radar
                  key={a.id}
                  name={a.titulo}
                  dataKey={`audit${i}`}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e1e22',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [`${value}%`]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
