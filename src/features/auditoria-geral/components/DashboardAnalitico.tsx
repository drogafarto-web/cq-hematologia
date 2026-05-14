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
import type { AuditoriaGeral, BlocoId } from '../types';
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
    return finalizadas
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (finalizadas.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40 text-sm">Nenhuma auditoria finalizada para exibir analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 px-4 max-w-6xl mx-auto">
      {/* Score Evolution */}
      <section className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
        <h2 className="text-sm font-medium text-white/60 mb-4">Evolucao do Score</h2>
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
      <section className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
        <h2 className="text-sm font-medium text-white/60 mb-4">Distribuicao de NCs por Bloco</h2>
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
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-sm font-medium text-white/60 mb-4">Performance dos Auditores</h2>
          <div className="space-y-2">
            {auditorPerformance.map((a) => (
              <div key={a.uid} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-sm text-white/80">{a.nome}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/40 font-mono">{a.count} auditorias</span>
                  <span className={`text-sm font-mono font-medium ${a.media >= 70 ? 'text-emerald-400' : a.media >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {a.media}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bloco Heatmap */}
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-sm font-medium text-white/60 mb-4">Heatmap por Bloco</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {blocoHeatmap.map((b) => (
              <div
                key={b.id}
                className="rounded-lg p-3 text-center border border-white/[0.04]"
                style={{ backgroundColor: `${getScoreColor(b.avg)}15` }}
              >
                <p className="text-lg font-mono font-bold" style={{ color: getScoreColor(b.avg) }}>
                  {b.avg}%
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">Bloco {b.id}</p>
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
