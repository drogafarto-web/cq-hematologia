/**
 * AlertCenter.tsx
 *
 * Real-time anomaly alerts dashboard component.
 * Displays active audit anomalies with severity classification and drill-down.
 *
 * Dark-first design (bg-[#141417], world-class UI reference: Apple/Linear/Stripe).
 * WCAG AA compliant (4.5:1 contrast, keyboard navigation, semantic structure).
 *
 * Phase 7 Wave 4: Advanced Auditoria
 * RDC 978 Art. 107 — Anomalies in operation audit trail
 * DICQ 4.4 — Audit monitoring + compliance tracking
 *
 * Features:
 * - Real-time subscription to /labs/{labId}/audit-alerts
 * - Filter by severity (critical|high|medium) and operator
 * - Alert table with 6 columns: operator, timestamp, dimension, severity, action, menu
 * - Empty state: "Nenhuma anomalia detectada"
 * - Pagination (max 50 per page)
 * - Dismiss action with feedback
 */

import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useAnomalyAlerts } from '../hooks/useAnomalyAlerts';
import type { AlertSeverity, AuditAlert } from '../types/anomalyTypes';
import type { LabId } from '../types/shared_refs';

interface AlertCenterProps {
  labId?: LabId;
  onDrillDown?: (alert: AuditAlert) => void;
}

interface FilterState {
  severity: AlertSeverity | 'all';
  operatorId: string | 'all';
}

export function AlertCenter({ labId: propLabId, onDrillDown }: AlertCenterProps) {
  const contextLabId = useActiveLabId();
  const labId = (propLabId || contextLabId) as LabId;

  const { alerts, loading, error, dismissAlert } = useAnomalyAlerts(labId);
  const [filters, setFilters] = useState<FilterState>({
    severity: 'all',
    operatorId: 'all',
  });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Format timestamp to DD/MM/YYYY HH:MM:SS
  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Get severity badge styling
  const getSeverityBadgeStyle = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/20 text-red-400 border border-red-600/50';
      case 'high':
        return 'bg-orange-600/20 text-orange-400 border border-orange-600/50';
      case 'medium':
        return 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50';
    }
  };

  const getSeverityLabel = (severity: AlertSeverity): string => {
    const labels: Record<AlertSeverity, string> = {
      critical: 'Crítica',
      high: 'Alta',
      medium: 'Média',
    };
    return labels[severity];
  };

  // Get primary dimension (highest score)
  const getPrimaryDimension = (alert: AuditAlert): string => {
    if (!alert.anomalyScore.dimensions || alert.anomalyScore.dimensions.length === 0) {
      return '—';
    }
    const highest = alert.anomalyScore.dimensions.reduce((a, b) =>
      a.score > b.score ? a : b
    );
    return highest.dimension.replace(/_/g, ' ');
  };

  // Filter alerts based on current selection
  const filteredAlerts = alerts.filter((alert) => {
    if (filters.severity !== 'all' && alert.severity !== filters.severity) {
      return false;
    }
    if (filters.operatorId !== 'all' && alert.anomalyScore.operatorId !== filters.operatorId) {
      return false;
    }
    return true;
  });

  // Paginate filtered alerts
  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE);
  const paginatedAlerts = filteredAlerts.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  // Extract unique operator IDs for filter dropdown
  const operatorIds = Array.from(
    new Set(alerts.map((a) => a.anomalyScore.operatorId))
  );

  // Handlers
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page on filter change
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert(alertId, 'dismissed_from_dashboard');
    } catch (err) {
      console.error('[AlertCenter] Dismiss error:', err);
    }
  };

  const hasActiveFilters = filters.severity !== 'all' || filters.operatorId !== 'all';

  return (
    <div className="space-y-6 bg-[#141417] p-6 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-white">Anomalias Detectadas</h2>
          <p className="text-sm text-white/60 mt-1">
            {filteredAlerts.length > 0
              ? `${filteredAlerts.length} anomalia${filteredAlerts.length === 1 ? '' : 's'} ativa${filteredAlerts.length === 1 ? '' : 's'}`
              : 'Nenhuma anomalia detectada'}
          </p>
        </div>
        <button
          onClick={() => {
            // Trigger refresh via Firebase subscription re-fetch
            window.location.reload();
          }}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Atualizar anomalias"
        >
          Atualizar
        </button>
      </div>

      {/* Filters Panel */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <h3 className="text-sm font-medium text-white">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Severity Filter */}
          <div className="space-y-2">
            <label htmlFor="filter-severity" className="text-xs font-medium text-white/70 block">
              Severidade
            </label>
            <select
              id="filter-severity"
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              aria-label="Filtrar por severidade"
            >
              <option value="all">Todas as severidades</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
            </select>
          </div>

          {/* Operator Filter */}
          <div className="space-y-2">
            <label htmlFor="filter-operator" className="text-xs font-medium text-white/70 block">
              Operador
            </label>
            <select
              id="filter-operator"
              value={filters.operatorId}
              onChange={(e) => handleFilterChange('operatorId', e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              aria-label="Filtrar por operador"
            >
              <option value="all">Todos os operadores</option>
              {operatorIds.map((opId) => (
                <option key={opId} value={opId}>
                  {opId}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilters({ severity: 'all', operatorId: 'all' });
              setPage(0);
            }}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
            aria-label="Limpar todos os filtros"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-400 font-medium">Erro ao carregar anomalias</p>
          <p className="text-xs text-red-400/70 mt-1">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {paginatedAlerts.length === 0 && !loading && (
        <div className="rounded-lg border border-white/10 p-12 text-center">
          <p className="text-white/50">Nenhuma anomalia detectada</p>
        </div>
      )}

      {/* Alert Table */}
      {paginatedAlerts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm" aria-label="Anomalias detectadas">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 sticky top-0 z-10">
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Operador
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Data/Hora
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Dimensão
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Severidade
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Ação
                </th>
                <th
                  className="px-4 py-3 text-center font-medium text-white/70"
                  scope="col"
                  aria-sort="none"
                >
                  Menu
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedAlerts.map((alert, index) => (
                <tr
                  key={alert.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  onClick={() => onDrillDown?.(alert)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onDrillDown?.(alert);
                    }
                  }}
                  aria-label={`Anomalia ${index + 1}: ${alert.severity} em ${formatTimestamp(alert.createdAt)}`}
                >
                  <td className="px-4 py-3 text-white/80 text-sm font-medium">
                    {alert.anomalyScore.operatorId}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs font-mono">
                    {formatTimestamp(alert.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">
                    {getPrimaryDimension(alert)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getSeverityBadgeStyle(
                        alert.severity,
                      )}`}
                      aria-label={`Severidade: ${getSeverityLabel(alert.severity)}`}
                    >
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDrillDown?.(alert);
                      }}
                      className="text-violet-400 hover:text-violet-300 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
                      aria-label={`Investigar anomalia ${alert.id}`}
                    >
                      Investigar
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(alert.id);
                      }}
                      className="text-white/50 hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
                      aria-label={`Descartar anomalia ${alert.id}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
            <p className="text-sm text-white/60">Carregando anomalias...</p>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {paginatedAlerts.length > 0 && !loading && totalPages > 1 && (
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4"
          role="navigation"
          aria-label="Paginação"
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Página anterior"
          >
            Anterior
          </button>

          <span className="text-sm text-white/60">
            Página {page + 1} de {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Próxima página"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
