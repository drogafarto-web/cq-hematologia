import React, { useMemo, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { LaudoDownloadButton } from './LaudoDownloadButton';
import type { PatientPortalLaudo } from '../types/index';

interface LaudoListProps {
  laudos: PatientPortalLaudo[];
  isLoading: boolean;
  error: Error | null;
  onView?: (laudo: PatientPortalLaudo) => void;
  onRefresh?: () => void;
  sortBy?: 'date-newest' | 'date-oldest' | 'exam-name';
  onSortChange?: (sort: 'date-newest' | 'date-oldest' | 'exam-name') => void;
}

/**
 * LaudoList — Main dashboard component
 *
 * Fetches patient's laudos via usePatientLaudos() hook
 * Displays dense table: Date | Exam | Status | Download | View
 * Sorting, filtering, pagination, empty/loading/error states
 *
 * Dark-first design, keyboard navigable
 * Usage:
 *   const { laudos, isLoading, error } = usePatientLaudos(labId, patientId);
 *   <LaudoList laudos={laudos} isLoading={isLoading} error={error} />
 */

const ITEMS_PER_PAGE = 20;

function LaudoSkeleton() {
  return (
    <tr className="border-b border-white/6 hover:bg-white/3">
      <td className="px-4 py-3">
        <div className="h-3 bg-white/8 rounded w-24 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 bg-white/8 rounded w-32 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-white/8 rounded w-20 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-white/8 rounded w-16 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-white/8 rounded w-16 animate-pulse" />
      </td>
    </tr>
  );
}

export const LaudoList = React.memo(function LaudoList({
  laudos,
  isLoading,
  error,
  onView,
  onRefresh,
  sortBy = 'date-newest',
  onSortChange,
}: LaudoListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Sort and paginate
  const sorted = useMemo(() => {
    const copy = [...laudos];
    if (sortBy === 'date-newest') {
      copy.sort((a, b) => b.dataResultado.toDate().getTime() - a.dataResultado.toDate().getTime());
    } else if (sortBy === 'date-oldest') {
      copy.sort((a, b) => a.dataResultado.toDate().getTime() - b.dataResultado.toDate().getTime());
    } else if (sortBy === 'exam-name') {
      copy.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return copy;
  }, [laudos, sortBy]);

  const paginatedLaudos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [sorted, currentPage]);

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);

  if (isLoading && laudos.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8 bg-white/2">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Data
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Exame
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <LaudoSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <h3 className="font-semibold text-red-300 mb-2">Erro ao carregar laudos</h3>
        <p className="text-sm text-red-200 mb-3">{error.message}</p>
        <button
          onClick={onRefresh}
          className="
            px-4 py-2 rounded-lg
            bg-red-500/20 text-red-300 hover:bg-red-500/30
            text-sm font-medium transition-colors
            border border-red-500/30
          "
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (laudos.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/4 p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="font-semibold text-white mb-2">Nenhum laudo disponível</h3>
        <p className="text-sm text-slate-400 mb-4">
          Seus resultados de laboratório aparecerão aqui quando estiverem prontos.
        </p>
        <button
          onClick={onRefresh}
          className="
            px-4 py-2 rounded-lg
            bg-blue-500/20 text-blue-300 hover:bg-blue-500/30
            text-sm font-medium transition-colors
            border border-blue-500/30
          "
        >
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sorting controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) =>
              onSortChange?.(e.target.value as 'date-newest' | 'date-oldest' | 'exam-name')
            }
            className="
              px-3 py-1.5 rounded-lg text-sm
              bg-white/8 border border-white/10 text-white
              hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50
            "
          >
            <option value="date-newest">Mais recentes</option>
            <option value="date-oldest">Mais antigos</option>
            <option value="exam-name">Nome do exame</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          {laudos.length} laudo{laudos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/8 bg-white/4 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8 bg-white/2">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Data
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Exame
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Baixar
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Ver
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLaudos.map((laudo) => (
              <tr
                key={laudo.id}
                className="border-b border-white/6 hover:bg-white/3 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">
                  {dateFormatter.format(laudo.dataResultado.toDate())}
                </td>
                <td className="px-4 py-3 text-sm text-white font-medium">{laudo.nome}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={laudo.status} criticoFlag={laudo.criticoFlag} />
                </td>
                <td className="px-4 py-3 text-center">
                  <LaudoDownloadButton laudo={laudo} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onView?.(laudo)}
                    className="
                      inline-flex items-center justify-center
                      w-8 h-8 rounded-lg
                      bg-blue-500/20 text-blue-300 hover:bg-blue-500/30
                      transition-colors
                      border border-blue-500/30
                    "
                    title="Ver resultado completo"
                    aria-label={`Ver ${laudo.nome}`}
                  >
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="
              px-3 py-1.5 rounded-lg text-sm
              bg-white/8 border border-white/10 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-white/10 transition-colors
            "
          >
            ← Anterior
          </button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`
                  w-8 h-8 rounded-lg text-sm font-medium transition-colors
                  ${
                    currentPage === i + 1
                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-white/8 border border-white/10 text-slate-400 hover:bg-white/10'
                  }
                `}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="
              px-3 py-1.5 rounded-lg text-sm
              bg-white/8 border border-white/10 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:bg-white/10 transition-colors
            "
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
});
