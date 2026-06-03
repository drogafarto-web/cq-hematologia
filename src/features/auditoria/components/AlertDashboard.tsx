/**
 * SA-11: AlertDashboard — Filter + severity-coded alert list
 *
 * Displays anomaly alerts with severity filtering, date-range selection,
 * and real-time updates. Dark-first design, WCAG AA compliant.
 *
 * RDC 978 5.3 + DICQ 4.4 — surfaces who/what/when/where context for anomalies.
 */

import React, { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useAnomalyAlerts, type AnomalyAlert, type AlertSeverity } from '../hooks/useAnomalyAlerts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertDashboardProps {
  labId: string;
  initialFilters?: {
    severity?: AlertSeverity;
    from?: number;
    to?: number;
  };
  onOpenDetail?: (alert: AnomalyAlert) => void;
}

// ─── Severity Badge Colors ────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string }> = {
  low: { bg: 'bg-white/10', text: 'text-white/70' },
  medium: { bg: 'bg-amber-500/15', text: 'text-amber-300' },
  high: { bg: 'bg-rose-500/15', text: 'text-rose-300' },
  critical: { bg: 'bg-rose-500/30 ring-1 ring-rose-400/40', text: 'text-rose-100' },
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertDashboard({
  labId,
  initialFilters,
  onOpenDetail,
}: AlertDashboardProps): JSX.Element {
  const [selectedSeverities, setSelectedSeverities] = useState<AlertSeverity[]>(
    initialFilters?.severity ? [initialFilters.severity] : [],
  );
  const [dateFrom, setDateFrom] = useState<string>(() => {
    if (!initialFilters?.from) return '';
    return new Date(initialFilters.from).toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    if (!initialFilters?.to) return '';
    return new Date(initialFilters.to).toISOString().split('T')[0];
  });

  // Build filter object for hook
  const filters = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : undefined;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : undefined;

    return {
      severity: selectedSeverities.length > 0 ? selectedSeverities : undefined,
      from: fromMs,
      to: toMs,
    };
  }, [selectedSeverities, dateFrom, dateTo]);

  const { alerts, loading, error } = useAnomalyAlerts(labId, filters);

  // Memoize alert list rendering for >50 items
  const alertCards = useMemo(() => {
    return alerts.map((alert) => (
      <div
        key={alert.id}
        className="flex flex-col gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  SEVERITY_STYLES[alert.severity].bg
                } ${SEVERITY_STYLES[alert.severity].text}`}
              >
                {SEVERITY_LABELS[alert.severity]}
              </span>
              <span className="text-xs text-white/50">{alert.scope}</span>
            </div>
            <p className="text-sm text-white/90 leading-5">{alert.shortDescription}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-white/60">
          <time dateTime={new Date(alert.detectedAt).toISOString()}>
            {new Date(alert.detectedAt).toLocaleString('pt-BR')}
          </time>
          <button
            onClick={() => onOpenDetail?.(alert)}
            className="text-violet-400 hover:text-violet-300 focus-visible:outline-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 transition-colors"
            aria-label={`Ver detalhes do alerta "${alert.shortDescription}"`}
          >
            Abrir detalhes →
          </button>
        </div>
      </div>
    ));
  }, [alerts, onOpenDetail]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Bar */}
      <div className="flex flex-col gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
        <div>
          <label className="text-xs font-medium text-white/70 tracking-wider uppercase mb-2 block">
            Severidade
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => {
                  setSelectedSeverities((prev) =>
                    prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
                  );
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedSeverities.includes(sev)
                    ? `${SEVERITY_STYLES[sev].bg} ${SEVERITY_STYLES[sev].text}`
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400`}
              >
                {SEVERITY_LABELS[sev]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label
              htmlFor="date-from"
              className="text-xs font-medium text-white/70 tracking-wider uppercase mb-2 block"
            >
              Desde
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-violet-400 focus:outline focus:outline-2"
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="date-to"
              className="text-xs font-medium text-white/70 tracking-wider uppercase mb-2 block"
            >
              Até
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-violet-400 focus:outline focus:outline-2"
            />
          </div>
        </div>
      </div>

      {/* State Rendering */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-rose-500/15 border border-rose-400/30">
          <div className="text-sm text-rose-200">Erro ao carregar alertas: {error.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-white/5 border border-white/10 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-2 h-2 rounded-full bg-violet-500/40 animate-pulse mb-3" />
          <p className="text-sm text-white/60">Nenhum alerta no período</p>
        </div>
      )}

      {!loading && alerts.length > 0 && <div className="flex flex-col gap-3">{alertCards}</div>}
    </div>
  );
}
