/**
 * ConsentBackfillDashboard.tsx
 * Read-only monitoring dashboard for consent backfill progress.
 *
 * Displays:
 * - Per-lab coverage % (total patients with consents / total unique patients)
 * - Consent timeline (area chart: consents per day, trend line)
 * - Scope breakdown (ia-strip vs ia-laudo vs analytics pie)
 *
 * Compliance: LGPD Arts. 7º, 11; RDC 978 Art. 128
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId } from '../../store/useAuthStore';

interface LabConsentMetrics {
  labId: string;
  totalPatients: number;
  patientsWithConsent: number;
  coveragePercent: number;
  byScope: {
    iaStrip: number;
    iaLaudo: number;
    analytics: number;
  };
  timelineData: Array<{
    date: string;
    count: number;
    cumulative: number;
  }>;
  lastUpdated: string;
}

function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 12l3-4 2 3 5-7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Coverage gauge — circular progress indicator
 */
function CoverageGauge({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percent / 100) * circumference;

  const getColor = (p: number) => {
    if (p >= 95) return '#10b981'; // emerald
    if (p >= 75) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute" width="128" height="128" viewBox="0 0 128 128">
        {/* Background circle */}
        <circle cx="64" cy="64" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        {/* Progress circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke={getColor(percent)}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-bold text-white">{percent}%</p>
        <p className="text-xs text-white/60 mt-1">Cobertura</p>
      </div>
    </div>
  );
}

/**
 * Simple timeline area chart
 */
function TimelineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-white/50 text-sm">
        Sem dados de timeline
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const width = 300;
  const height = 120;
  const points = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - (d.count / maxCount) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-32" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1="0"
          y1={height * (1 - pct)}
          x2={width}
          y2={height * (1 - pct)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}
      {/* Area */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="rgba(139,92,246,0.15)"
        stroke="none"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="rgb(139,92,246)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      {data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * width;
        const y = height - (d.count / maxCount) * height;
        return <circle key={i} cx={x} cy={y} r="2.5" fill="rgb(139,92,246)" />;
      })}
    </svg>
  );
}

/**
 * Pie chart for scope breakdown
 */
function ScopeBreakdown({
  data,
}: {
  data: { iaStrip: number; iaLaudo: number; analytics: number };
}) {
  const total = data.iaStrip + data.iaLaudo + data.analytics;

  if (total === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-white/50 text-sm">
        Sem dados de escopo
      </div>
    );
  }

  const pcts = {
    iaStrip: (data.iaStrip / total) * 100,
    iaLaudo: (data.iaLaudo / total) * 100,
    analytics: (data.analytics / total) * 100,
  };

  // Simple donut chart
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  const createArc = (startPct: number, endPct: number, color: string) => {
    const startOffset = (startPct / 100) * circumference;
    const endOffset = (endPct / 100) * circumference;
    const length = endOffset - startOffset;

    return (
      <circle
        key={color}
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={-startOffset}
        strokeLinecap="round"
      />
    );
  };

  let currentPct = 0;

  return (
    <div className="flex items-center justify-between">
      <svg className="w-32 h-32" viewBox="0 0 120 120">
        {createArc(currentPct, (currentPct += pcts.iaStrip), 'rgb(168,85,247)')}
        {createArc(currentPct, (currentPct += pcts.iaLaudo), 'rgb(59,130,246)')}
        {createArc(currentPct, (currentPct += pcts.analytics), 'rgb(34,197,94)')}
      </svg>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-sm text-white/80">
            ia-strip: {data.iaStrip} ({pcts.iaStrip.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-white/80">
            ia-laudo: {data.iaLaudo} ({pcts.iaLaudo.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-white/80">
            analytics: {data.analytics} ({pcts.analytics.toFixed(0)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main dashboard component
 */
export function ConsentBackfillDashboard() {
  const labId = useActiveLabId();
  const [metrics, setMetrics] = useState<LabConsentMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!labId) return;

    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        // TODO: Call service to fetch `/labs/{labId}/consent-backfill-state/` + aggregated stats
        // For now, initialize with stub data
        setMetrics({
          labId,
          lastUpdated: new Date().toISOString(),
          totalPatients: 450,
          patientsWithConsent: 382,
          coveragePercent: 85,
          byScope: {
            iaStrip: 382,
            iaLaudo: 150,
            analytics: 95,
          },
          timelineData: [
            { date: '2026-05-01', count: 10, cumulative: 10 },
            { date: '2026-05-02', count: 25, cumulative: 35 },
            { date: '2026-05-03', count: 45, cumulative: 80 },
            { date: '2026-05-04', count: 52, cumulative: 132 },
            { date: '2026-05-05', count: 62, cumulative: 194 },
            { date: '2026-05-06', count: 55, cumulative: 249 },
            { date: '2026-05-07', count: 60, cumulative: 309 },
            { date: '2026-05-08', count: 73, cumulative: 382 },
          ],
        });
      } catch (err) {
        console.error('[loadMetrics]', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [labId]);

  if (!labId) {
    return (
      <div className="p-6 bg-white/2 rounded-lg border border-white/5 text-white/70 text-sm">
        Selecione um laboratório para visualizar métricas
      </div>
    );
  }

  if (isLoading || !metrics) {
    return (
      <div className="p-6 flex items-center justify-center text-white/50">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="ml-3 text-sm">Carregando métricas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Monitoramento de consentimento</h1>
        <p className="text-white/60 text-sm">
          Últimas atualizações: {new Date(metrics.lastUpdated).toLocaleString()}
        </p>
      </div>

      {/* Coverage grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coverage gauge */}
        <div className="p-6 bg-white/2 rounded-lg border border-white/5 flex justify-center">
          <CoverageGauge percent={metrics.coveragePercent} />
        </div>

        {/* Stats cards */}
        <div className="space-y-3">
          <div className="p-4 bg-white/2 rounded-lg border border-white/5">
            <p className="text-xs text-white/50">Total de pacientes</p>
            <p className="text-2xl font-bold text-white mt-2">{metrics.totalPatients}</p>
          </div>
          <div className="p-4 bg-white/2 rounded-lg border border-white/5">
            <p className="text-xs text-white/50">Com consentimento</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">
              {metrics.patientsWithConsent}
            </p>
          </div>
        </div>

        {/* Health indicator */}
        <div className="p-6 bg-white/2 rounded-lg border border-white/5">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-2">Status de cobertura</p>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    metrics.coveragePercent >= 95
                      ? 'bg-emerald-500'
                      : metrics.coveragePercent >= 75
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-white/80">
                  {metrics.coveragePercent >= 95
                    ? 'Pronto para cutover'
                    : metrics.coveragePercent >= 75
                      ? 'Progresso bom'
                      : 'Abaixo do alvo'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-2">Alvo (≥95%)</p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(metrics.coveragePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-6 bg-white/2 rounded-lg border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <TrendIcon />
          <h2 className="text-sm font-semibold text-white">Timeline de captura</h2>
        </div>
        <TimelineChart data={metrics.timelineData.map((d) => ({ date: d.date, count: d.count }))} />
        <p className="text-xs text-white/50 mt-3">
          {metrics.timelineData.length} dias · máx{' '}
          {Math.max(...metrics.timelineData.map((d) => d.count))} consentimentos/dia
        </p>
      </div>

      {/* Scope breakdown */}
      <div className="p-6 bg-white/2 rounded-lg border border-white/5">
        <h2 className="text-sm font-semibold text-white mb-4">Escopo de consentimento</h2>
        <ScopeBreakdown data={metrics.byScope} />
      </div>

      {/* Info footer */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm space-y-1">
        <p className="font-medium">Nota</p>
        <p>
          Estes dados são atualizados a cada 30 minutos. Para atualizações em tempo real, consulte
          os logs de auditoria (auditLogs/action='consent-captured').
        </p>
      </div>
    </div>
  );
}
