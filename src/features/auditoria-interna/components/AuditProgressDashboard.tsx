import React, { useMemo } from 'react';
import { CheckCircle2, XCircle, MinusCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface AuditProgressDashboardProps {
  sessaoId: string;
  auditoriaId: string;
  labId: string;
  responses: Array<{
    itemId: string;
    resposta: 'conforme' | 'nao-conforme' | 'N/A' | null;
    bloco: string;
    categoria: string;
  }>;
  previousScore?: number | null;
}

const BLOCO_LABELS: Record<string, string> = {
  A: 'Doc. Legal',
  B: 'Contratos',
  C: 'Tecnologia',
  D: 'Gestão',
  E: 'Infraestrutura',
  F: 'Pré-Analítica',
  G: 'Analítica',
  H: 'Pós-Analítica',
  I: 'Informática',
  J: 'Qualidade',
};

function CircularProgress({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
        <span className="text-xs text-white/50">Score</span>
      </div>
    </div>
  );
}

export function AuditProgressDashboard({ responses, previousScore }: AuditProgressDashboardProps) {
  const stats = useMemo(() => {
    const total = responses.length;
    const conforme = responses.filter((r) => r.resposta === 'conforme').length;
    const nc = responses.filter((r) => r.resposta === 'nao-conforme').length;
    const na = responses.filter((r) => r.resposta === 'N/A').length;
    const pendente = responses.filter((r) => r.resposta === null).length;
    const respondidos = total - pendente;
    const aplicaveis = total - na;
    const score = aplicaveis > 0 ? (conforme / aplicaveis) * 100 : 0;

    const byBloco: Record<string, { total: number; conforme: number; nc: number }> = {};
    responses.forEach((r) => {
      if (!byBloco[r.bloco]) byBloco[r.bloco] = { total: 0, conforme: 0, nc: 0 };
      byBloco[r.bloco].total++;
      if (r.resposta === 'conforme') byBloco[r.bloco].conforme++;
      if (r.resposta === 'nao-conforme') byBloco[r.bloco].nc++;
    });

    return { total, conforme, nc, na, pendente, respondidos, score, byBloco };
  }, [responses]);

  const trend = previousScore != null ? stats.score - previousScore : null;

  return (
    <div className="space-y-6">
      {/* Score + Summary */}
      <div className="flex items-center gap-6">
        <CircularProgress percentage={stats.score} />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            label="Conforme"
            value={stats.conforme}
            color="text-emerald-400"
          />
          <StatCard
            icon={<XCircle className="w-4 h-4 text-red-400" />}
            label="NC"
            value={stats.nc}
            color="text-red-400"
          />
          <StatCard
            icon={<MinusCircle className="w-4 h-4 text-white/40" />}
            label="N/A"
            value={stats.na}
            color="text-white/40"
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-amber-400" />}
            label="Pendente"
            value={stats.pendente}
            color="text-amber-400"
          />
        </div>
      </div>

      {/* Trend */}
      {trend !== null && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${trend >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
        >
          {trend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span
            className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}% vs auditoria anterior
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span>
            {stats.respondidos}/{stats.total} itens respondidos
          </span>
          <span>{Math.round((stats.respondidos / stats.total) * 100)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${(stats.respondidos / stats.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Score by Bloco */}
      <div>
        <h4 className="text-sm font-medium text-white/70 mb-3">Score por Bloco</h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats.byBloco)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([bloco, data]) => {
              const blocoScore = data.total > 0 ? (data.conforme / data.total) * 100 : 0;
              return (
                <div key={bloco} className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                  <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
                    {bloco}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/50 truncate">{BLOCO_LABELS[bloco] || bloco}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${blocoScore >= 80 ? 'bg-emerald-500' : blocoScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${blocoScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white/60">
                        {Math.round(blocoScore)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
      {icon}
      <div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </div>
  );
}
