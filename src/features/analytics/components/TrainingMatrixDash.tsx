/**
 * TrainingMatrixDash — Certification status table
 *
 * Shows training certifications per trainee × POP with expiration badges.
 * Status colors: emerald (valid), amber (expiring ≤30d), red (expired), muted (not trained).
 *
 * Data source: in Phase 3.1 uses aggregate summary counts (no per-row detail).
 * Phase 3.2+ will load from /labs/{labId}/analytics/cache/trainingMatrix.
 *
 * Design: HTML table (not Recharts) — tabular data is clearest in table form.
 */

import React, { useMemo } from 'react';
import { useAnalyticsAggregate, useAnalyticsLoading, useAnalyticsError } from '../hooks/useAnalyticsCache';
import { TRAINING_STATUS_COLORS } from '../services/chartColorMap';
import { FilterUnavailableBanner } from './FilterUnavailableBanner';
import { shouldShowPartialFilterNotice, filterCapabilities } from '../utils/aggregateFilters';
import type { CertificationStatus } from '../types/Analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingSummaryRow {
  module: string;
  moduleLabel: string;
  totalTrainees: number;
  certified: number;
  expiring: number;
  expired: number;
  notTrained: number;
  overallStatus: CertificationStatus;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: CertificationStatus; label?: string }) {
  const colors = TRAINING_STATUS_COLORS[status];
  const defaultLabel: Record<CertificationStatus, string> = {
    valid: 'Válido',
    expiring: 'Vencendo',
    expired: 'Vencido',
    not_trained: 'Não treinado',
  };

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        colors.bg,
        colors.text,
        colors.border,
      ].join(' ')}
    >
      {label ?? defaultLabel[status]}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function CertProgressBar({ certified, total }: { certified: number; total: number }) {
  const pct = total > 0 ? Math.round((certified / total) * 100) : 0;
  const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2" role="group" aria-label={`${pct}% certificados`}>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden" aria-hidden>
        <div
          className={['h-full rounded-full transition-all duration-500', barColor].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-white/50 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-1">
      <div className="h-8 rounded bg-white/8" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 rounded bg-white/4" />
      ))}
    </div>
  );
}

// ─── Data derivation ──────────────────────────────────────────────────────────

/**
 * Synthesize summary rows from aggregate NC-by-module data.
 * Phase 3.2 replaces this with real training matrix data.
 */
function deriveTrainingSummary(
  ncByModule: Record<string, number>,
  totalRuns: number,
): TrainingSummaryRow[] {
  const modules = Object.keys(ncByModule);
  if (modules.length === 0) return [];

  // Simulate training completeness based on NC rate (higher NCs → more training gaps)
  return modules.map((slug) => {
    const ncCount = ncByModule[slug];
    const baseTrainees = Math.max(3, Math.min(15, Math.round(totalRuns / 20)));
    const certRate = Math.max(0.4, 1 - ncCount / Math.max(1, totalRuns) * 5);
    const certified = Math.round(baseTrainees * certRate);
    const expiring = Math.min(baseTrainees - certified, Math.round(baseTrainees * 0.1));
    const expired = Math.max(0, Math.round(baseTrainees * (1 - certRate) * 0.3));
    const notTrained = Math.max(0, baseTrainees - certified - expiring - expired);

    const overallStatus: CertificationStatus =
      expired > 0 ? 'expired' :
      expiring > 0 ? 'expiring' :
      certified >= baseTrainees ? 'valid' :
      'not_trained';

    return {
      module: slug,
      moduleLabel: formatModuleLabel(slug),
      totalTrainees: baseTrainees,
      certified,
      expiring,
      expired,
      notTrained,
      overallStatus,
    };
  });
}

function formatModuleLabel(slug: string): string {
  const labels: Record<string, string> = {
    'ciq-imuno': 'Imunologia CIQ',
    coagulacao: 'Coagulação',
    uroanalise: 'Uroanálise',
    insumos: 'Insumos',
    pops: 'POPs',
    treinamentos: 'Treinamentos',
    biosseguranca: 'Biossegurança',
    pgrss: 'PGRSS',
    sgq: 'SGQ',
    analyzer: 'Hematologia',
  };
  return labels[slug] ?? slug;
}

// ─── Active filters ───────────────────────────────────────────────────────────

interface ActiveFilters {
  equipmentIds: Set<string>;
  operatorIds: Set<string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TrainingMatrixDashProps {
  className?: string;
  activeFilters?: ActiveFilters;
}

export const TrainingMatrixDash = React.memo(function TrainingMatrixDash({
  className = '',
  activeFilters,
}: TrainingMatrixDashProps) {
  const aggregate = useAnalyticsAggregate();
  const loading = useAnalyticsLoading();
  const error = useAnalyticsError();

  const equipmentIds = activeFilters?.equipmentIds ?? new Set<string>();
  const operatorIds = activeFilters?.operatorIds ?? new Set<string>();

  const showPartialNotice = shouldShowPartialFilterNotice('training', equipmentIds, operatorIds);
  const partialReason = filterCapabilities('training').reason;

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (equipmentIds.size > 0) parts.push(`${equipmentIds.size} equipamento${equipmentIds.size > 1 ? 's' : ''}`);
    if (operatorIds.size > 0) parts.push(`${operatorIds.size} operador${operatorIds.size > 1 ? 'es' : ''}`);
    return parts.join(', ');
  }, [equipmentIds, operatorIds]);

  const rows = useMemo((): TrainingSummaryRow[] => {
    if (!aggregate) return [];
    return deriveTrainingSummary(aggregate.ncByModule, aggregate.totalRuns);
  }, [aggregate]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const total = rows.reduce((s, r) => s + r.totalTrainees, 0);
    const certified = rows.reduce((s, r) => s + r.certified, 0);
    const expired = rows.reduce((s, r) => s + r.expired, 0);
    const expiring = rows.reduce((s, r) => s + r.expiring, 0);
    return { total, certified, expired, expiring };
  }, [rows]);

  if (loading) {
    return (
      <section className={['space-y-4', className].join(' ')} aria-label="Matriz de treinamentos">
        <div className="h-4 w-48 rounded bg-white/10 animate-pulse" />
        <TableSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Falha ao carregar matriz de treinamentos: {error}
      </div>
    );
  }

  return (
    <section
      className={['space-y-4', className].join(' ')}
      aria-label="Matriz de certificações por módulo"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
            Matriz de Treinamentos
          </h2>
          <p className="text-xs text-white/30 mt-0.5">
            Certificações por módulo — ISO 15189 §6.2
          </p>
        </div>

        {/* Summary badges */}
        {summary && (
          <div className="flex items-center gap-2">
            {summary.expired > 0 && (
              <StatusBadge status="expired" label={`${summary.expired} vencidos`} />
            )}
            {summary.expiring > 0 && (
              <StatusBadge status="expiring" label={`${summary.expiring} vencendo`} />
            )}
            {summary.expired === 0 && summary.expiring === 0 && (
              <StatusBadge status="valid" label="Tudo em dia" />
            )}
          </div>
        )}
      </div>

      {/* Partial filter notice — aggregate has no per-equipment training breakdown */}
      {showPartialNotice && (
        <FilterUnavailableBanner
          reason={partialReason}
          activeFilterLabel={activeFilterLabel}
        />
      )}

      {/* Table */}
      {rows.length > 0 ? (
        <div className="w-full overflow-x-auto rounded-xl border border-white/8">
          <table className="min-w-[600px] w-full text-xs" role="table" aria-label="Certificações por módulo">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.025]">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-white/40 font-medium tracking-wide"
                >
                  Módulo
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-white/40 font-medium"
                >
                  Treinandos
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-white/40 font-medium"
                >
                  Certificados
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-white/40 font-medium"
                >
                  Vencendo
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-white/40 font-medium"
                >
                  Vencidos
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-white/40 font-medium"
                >
                  Cobertura
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-white/40 font-medium"
                >
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr
                  key={row.module}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 text-white/70 font-medium">
                    {row.moduleLabel}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-white/50">
                    {row.totalTrainees}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-emerald-400">
                    {row.certified}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {row.expiring > 0 ? (
                      <span className="text-amber-400">{row.expiring}</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {row.expired > 0 ? (
                      <span className="text-red-400">{row.expired}</span>
                    ) : (
                      <span className="text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-36">
                    <CertProgressBar
                      certified={row.certified}
                      total={row.totalTrainees}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={row.overallStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-white/30">
          Nenhum dado de treinamento disponível.
          Os dados serão exibidos após o módulo de Treinamentos emitir certificações.
        </div>
      )}

      {/* ISO footnote */}
      <p className="text-xs text-white/20 px-1">
        Dados simulados em Phase 3.1. Dados reais disponíveis após integração com módulo de Treinamentos (Phase 3.2).
      </p>
    </section>
  );
});
