/**
 * CriticosSLADashboard — SLA metrics and breach tracking
 *
 * Features:
 * - Period selector (24h / 7d / 30d)
 * - KPI tiles: total alerts, % SLA breach, p50/p95 ack time
 * - Inline sparkline of breach rate over time
 * - List of breached alerts with time-to-ack
 * - Dark-first design, WCAG AA
 *
 * Implements RDC 978 Art. 5.7.1 (critical communication <60min)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { getSLAMetrics, aggregateSLA } from '../services/slaTracker';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { SLAMetric } from '../services/slaTracker';

type PeriodDays = 1 | 7 | 30;

interface DayBucket {
  day: string;
  total: number;
  breached: number;
  breachRate: number;
}

export default function CriticosSLADashboard() {
  const labId = useActiveLabId();
  const [period, setPeriod] = useState<PeriodDays>(1);
  const [metrics, setMetrics] = useState<SLAMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metrics
  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const loadMetrics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const now = Date.now();
        const fromMs = now - period * 24 * 60 * 60 * 1000;

        const data = await getSLAMetrics(labId, { from: fromMs, to: now });
        setMetrics(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar métricas';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [labId, period]);

  // Compute aggregates
  const agg = useMemo(() => aggregateSLA(metrics), [metrics]);

  // Compute daily buckets for sparkline
  const dailyBuckets = useMemo(() => {
    const buckets = new Map<string, DayBucket>();

    // Initialize buckets for each day in range
    for (let i = period - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      buckets.set(dayStr, { day: dayStr, total: 0, breached: 0, breachRate: 0 });
    }

    // Populate with metric data
    metrics.forEach((m) => {
      const dayStr = new Date(m.detectedAt).toISOString().split('T')[0];
      const bucket = buckets.get(dayStr);
      if (bucket) {
        bucket.total += 1;
        if (m.slaBreached) bucket.breached += 1;
      }
    });

    // Compute breach rates
    buckets.forEach((bucket) => {
      bucket.breachRate = bucket.total > 0 ? (bucket.breached / bucket.total) * 100 : 0;
    });

    return Array.from(buckets.values());
  }, [metrics, period]);

  // Get breached alerts for list
  const breachedAlerts = useMemo(() => {
    return metrics
      .filter((m) => m.slaBreached)
      .sort((a, b) => (b.timeToAcknowledgeMs || 0) - (a.timeToAcknowledgeMs || 0))
      .slice(0, 10);
  }, [metrics]);

  const breachPercent =
    agg.count > 0 ? ((agg.breachedCount / agg.count) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Métricas de SLA</h2>
          <p className="text-white/50 text-sm mt-1">
            Rastreamento de tempo de reconhecimento (RDC 978 Art. 5.7.1)
          </p>
        </div>
        <div className="flex gap-2">
          {([1, 7, 30] as const).map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                period === days
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/5 text-white/70 hover:text-white'
              }`}
            >
              {days === 1 ? '24h' : `${days}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-violet-500/20 flex items-center justify-center animate-pulse">
              <div className="w-4 h-4 bg-violet-400 rounded-full" />
            </div>
            <p className="text-white/70 text-sm">Carregando métricas...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPITile
              label="Total de Alertas"
              value={agg.count}
              unit=""
              suffix=""
              variant="default"
            />
            <KPITile
              label="% SLA Breached"
              value={parseFloat(breachPercent)}
              unit="%"
              suffix="1"
              variant={parseFloat(breachPercent) > 10 ? 'warning' : 'default'}
            />
            <KPITile
              label="P50 Ack Time"
              value={Math.round(agg.p50Ms / 1000 / 60)}
              unit="min"
              suffix=""
              variant="default"
            />
            <KPITile
              label="P95 Ack Time"
              value={Math.round(agg.p95Ms / 1000 / 60)}
              unit="min"
              suffix=""
              variant={Math.round(agg.p95Ms / 1000 / 60) > 60 ? 'danger' : 'default'}
            />
          </div>

          {/* Sparkline chart */}
          {dailyBuckets.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
                Taxa de SLA Breach por Dia
              </p>
              <SparklineChart data={dailyBuckets} />
            </div>
          )}

          {/* Breached alerts list */}
          {breachedAlerts.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-white/50 text-sm">
                Nenhum alerta com SLA vencido no período.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <div className="bg-white/5 border-b border-white/10 p-4">
                <p className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Alertas com SLA Vencido (top 10)
                </p>
              </div>
              <div className="divide-y divide-white/10">
                {breachedAlerts.map((alert) => (
                  <div key={alert.alertId} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/70 text-sm font-mono">{alert.alertId}</p>
                        <p className="text-white/50 text-xs mt-1">
                          Detectado:{' '}
                          {new Date(alert.detectedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-rose-400 font-medium tabular-nums">
                          +{Math.round((alert.timeToAcknowledgeMs || 0) / 1000 / 60)} min
                        </p>
                        <p className="text-white/50 text-xs mt-1">
                          {(
                            ((alert.timeToAcknowledgeMs || 0) / alert.slaTargetMs) *
                            100
                          ).toFixed(0)}% do SLA
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * KPI Tile component
 */
interface KPITileProps {
  label: string;
  value: number;
  unit: string;
  suffix: string;
  variant: 'default' | 'warning' | 'danger';
}

function KPITile({ label, value, unit, suffix, variant }: KPITileProps) {
  const bgColor =
    variant === 'danger' ? 'bg-rose-500/10' : variant === 'warning' ? 'bg-amber-500/10' : 'bg-violet-500/10';
  const textColor =
    variant === 'danger' ? 'text-rose-300' : variant === 'warning' ? 'text-amber-300' : 'text-violet-300';

  return (
    <div className={`rounded-lg border border-white/10 ${bgColor} p-4`}>
      <p className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${textColor}`}>
        {value.toLocaleString('pt-BR', { maximumFractionDigits: parseInt(suffix) || 0 })}
        <span className="text-sm ml-1">{unit}</span>
      </p>
    </div>
  );
}

/**
 * Sparkline chart — inline SVG
 */
interface SparklineChartProps {
  data: Array<{ day: string; breachRate: number }>;
}

function SparklineChart({ data }: SparklineChartProps) {
  const maxRate = Math.max(...data.map((d) => d.breachRate), 1);
  const width = 100 / data.length;

  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((d, i) => {
        const height = (d.breachRate / maxRate) * 100;
        const color = d.breachRate > 10 ? 'bg-rose-500/80' : 'bg-emerald-500/80';
        return (
          <div
            key={i}
            className={`flex-1 ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
            style={{ height: `${Math.max(height, 5)}%` }}
            title={`${d.day}: ${d.breachRate.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}
