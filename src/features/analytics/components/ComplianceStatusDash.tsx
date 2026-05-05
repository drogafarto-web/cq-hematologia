/**
 * ComplianceStatusDash — KPI cards for CIQ compliance overview
 *
 * Displays 4 primary KPIs:
 *   1. Compliance % (valid runs / total runs)
 *   2. Open NCs (non-conformities awaiting resolution)
 *   3. Avg turnaround (processing hours)
 *   4. Retrabalho % (rework rate)
 *
 * Reads from Zustand store — no direct Firestore calls.
 * Shows skeleton cards while loading.
 */

import React, { useMemo } from 'react';
import { DashboardCard } from './DashboardCard';
import {
  useAnalyticsAggregate,
  useAnalyticsLoading,
  useAnalyticsError,
} from '../hooks/useAnalyticsCache';
import {
  calculateCompliance,
  calculateTurnaround,
  calculateRetrabalho,
  deriveKPISummary,
} from '../services/kpiCalculators';
import type { CardVariant } from './DashboardCard';

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M4 10l4.5 4.5L16 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M10 3L2 17h16L10 3z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
  </svg>
);

const ClockIcon = () => (
  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M10 6v4l3 2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RefreshCwIcon = () => (
  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M2.5 13A8 8 0 1 0 4.5 6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M2 10V6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── KPI variant logic ────────────────────────────────────────────────────────

function complianceVariant(pct: number): CardVariant {
  if (pct >= 95) return 'success';
  if (pct >= 85) return 'warning';
  return 'critical';
}

function ncVariant(count: number): CardVariant {
  if (count === 0) return 'success';
  if (count <= 3) return 'warning';
  return 'critical';
}

function turnaroundVariant(hours: number): CardVariant {
  if (hours <= 2) return 'success';
  if (hours <= 8) return 'warning';
  return 'critical';
}

function retrabalhoVariant(pct: number): CardVariant {
  if (pct <= 2) return 'success';
  if (pct <= 5) return 'warning';
  return 'critical';
}

// ─── Active filters ───────────────────────────────────────────────────────────

interface ActiveFilters {
  equipmentIds: Set<string>;
  operatorIds: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ComplianceStatusDashProps {
  className?: string;
  /** Filter state from AnalyticsHub — passed through for future aggregate filtering */
  activeFilters?: ActiveFilters;
}

export const ComplianceStatusDash = React.memo(function ComplianceStatusDash({
  className = '',
  activeFilters: _activeFilters,
}: ComplianceStatusDashProps) {
  const aggregate = useAnalyticsAggregate();
  const loading = useAnalyticsLoading();
  const error = useAnalyticsError();

  const kpis = useMemo(() => {
    if (!aggregate) return null;
    return deriveKPISummary(aggregate);
  }, [aggregate]);

  const compliancePct = kpis?.compliancePercent ?? 0;
  const openNCs = kpis?.openNCs ?? 0;
  const turnaround = aggregate ? calculateTurnaround(aggregate.avgProcessingHours) : 0;
  const retrabalho = aggregate
    ? calculateRetrabalho(aggregate.retrabalhoCount, aggregate.totalRuns)
    : 0;

  // Error state
  if (error && !loading) {
    return (
      <section className={['space-y-1', className].join(' ')} aria-label="Status de conformidade">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          Falha ao carregar KPIs: {error}
        </div>
      </section>
    );
  }

  return (
    <section
      className={['space-y-4', className].join(' ')}
      aria-label="KPIs de conformidade CIQ"
    >
      {/* Section header */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
          Status de Conformidade
        </h2>
        {aggregate?.dataAsOf && (
          <p className="text-xs text-white/30 mt-0.5">
            Dados até:{' '}
            {aggregate.dataAsOf.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* KPI grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        role="list"
        aria-label="Indicadores chave"
      >
        {/* 1. Compliance */}
        <div role="listitem">
          <DashboardCard
            title="Conformidade CIQ"
            value={loading ? '—' : `${compliancePct}%`}
            subtitle={
              aggregate
                ? `${aggregate.validRuns} / ${aggregate.totalRuns} corridas`
                : undefined
            }
            delta={kpis?.complianceDelta}
            deltaLabel=" pp"
            variant={loading ? 'default' : complianceVariant(compliancePct)}
            icon={<CheckIcon />}
            loading={loading}
          />
        </div>

        {/* 2. Open NCs */}
        <div role="listitem">
          <DashboardCard
            title="NCs Abertas"
            value={loading ? '—' : openNCs}
            subtitle={
              aggregate
                ? `${aggregate.closedNCs} resolvidas`
                : undefined
            }
            delta={kpis?.ncDelta}
            deltaLabel=" NCs"
            variant={loading ? 'default' : ncVariant(openNCs)}
            icon={<AlertIcon />}
            loading={loading}
          />
        </div>

        {/* 3. Turnaround */}
        <div role="listitem">
          <DashboardCard
            title="Turnaround Médio"
            value={loading ? '—' : `${turnaround}h`}
            subtitle="Tempo de processamento"
            variant={loading ? 'default' : turnaroundVariant(turnaround)}
            icon={<ClockIcon />}
            loading={loading}
          />
        </div>

        {/* 4. Retrabalho */}
        <div role="listitem">
          <DashboardCard
            title="Retrabalho"
            value={loading ? '—' : `${retrabalho}%`}
            subtitle={
              aggregate
                ? `${aggregate.retrabalhoCount} corridas reprocessadas`
                : undefined
            }
            variant={loading ? 'default' : retrabalhoVariant(retrabalho)}
            icon={<RefreshCwIcon />}
            loading={loading}
          />
        </div>
      </div>

      {/* No data notice */}
      {!loading && !aggregate && !error && (
        <p className="text-sm text-white/30 text-center py-4">
          Nenhum dado de analytics disponível.
          Execute o agendador de agregação ou aguarde o próximo ciclo horário.
        </p>
      )}
    </section>
  );
});
