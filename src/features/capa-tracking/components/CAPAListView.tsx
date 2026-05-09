/**
 * CAPAListView.tsx — SA-27
 *
 * Filterable table of CAPAs with status, deadline, and severity.
 * Dark-first design with responsive overflow handling.
 */

import { useState, useMemo } from 'react';
import { useCAPAs } from '../hooks/useCAPAs';
import { CAPAStatusBadge } from './CAPAStatusBadge';
import type { CAPAWithDeadlineStatus, CapaStateLegacy } from '../types';

type FilterStatus = 'all' | CapaStateLegacy;

interface CAPAListViewProps {
  onSelect: (capaId: string) => void;
}

const STATUS_FILTERS: FilterStatus[] = [
  'all',
  'aberto',
  'em-andamento',
  'evidencia-submetida',
  'auditor-revisando',
  'fechado',
];

const STATUS_LABELS: Record<FilterStatus, string> = {
  all: 'Todos',
  'aberto': 'Aberto',
  'em-andamento': 'Em andamento',
  'evidencia-submetida': 'Evidência submetida',
  'auditor-revisando': 'Auditor revisando',
  'fechado': 'Fechado',
};

function getDeadlineColor(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'text-slate-400';
  if (daysRemaining < 0) return 'text-red-400';
  if (daysRemaining < 7) return 'text-red-400';
  if (daysRemaining < 14) return 'text-amber-400';
  return 'text-emerald-400';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-300 border border-red-500/30';
    case 'major':
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    case 'minor':
      return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    default:
      return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
  }
}

function Skeleton() {
  return (
    <tr className="border-t border-white/5 hover:bg-white/2 transition-colors">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-5 bg-slate-700/40 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function CAPAListView({ onSelect }: CAPAListViewProps) {
  const { capas, loading, error } = useCAPAs();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return capas;
    return capas.filter((c) => c.state === filterStatus);
  }, [capas, filterStatus]);

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300">
        <p className="text-sm font-medium">Erro ao carregar CAPAs</p>
        <p className="text-xs text-red-400 mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`
              px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-all
              ${
                filterStatus === status
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }
            `}
            aria-pressed={filterStatus === status}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Achado ID
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Título
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Estado
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Dias restantes
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Severidade
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-4 py-3">
                Ação
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Nenhuma CAPA encontrada
                </td>
              </tr>
            ) : (
              filtered.map((capa) => (
                <tr
                  key={capa.id}
                  className="border-t border-white/5 hover:bg-white/2 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {capa.finding.findingId.slice(-6)}
                  </td>
                  <td className="px-4 py-3 text-slate-200 max-w-xs truncate">
                    {capa.finding.title}
                  </td>
                  <td className="px-4 py-3">
                    <CAPAStatusBadge status={capa.state as CapaStateLegacy} />
                  </td>
                  <td className={`px-4 py-3 font-mono text-xs font-medium ${getDeadlineColor(capa.deadlineStatus.daysRemaining)}`}>
                    {capa.deadlineStatus.daysRemaining === null
                      ? '—'
                      : capa.deadlineStatus.daysRemaining < 0
                        ? `${Math.abs(capa.deadlineStatus.daysRemaining)}d vencido`
                        : `${capa.deadlineStatus.daysRemaining}d`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(capa.finding.severity)}`}>
                      {capa.finding.severity === 'critical' || capa.finding.severity === 'critica' ? 'Crítica' : capa.finding.severity === 'major' || capa.finding.severity === 'alta' ? 'Maior' : 'Menor'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onSelect(capa.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                      aria-label={`Ver CAPA ${capa.finding.findingId}`}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-white/2 rounded-lg border border-white/5 text-xs text-slate-400">
          <span>
            Total: <span className="font-semibold text-slate-200">{filtered.length}</span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Abertos:{' '}
            <span className="font-semibold text-red-400">
              {filtered.filter((c) => c.state === 'aberto').length}
            </span>
          </span>
          <span className="text-white/20">·</span>
          <span>
            Vencidos:{' '}
            <span className="font-semibold text-red-400">
              {filtered.filter((c) => (c.deadlineStatus.daysRemaining ?? 0) < 0).length}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
