/**
 * CAPADashboard.tsx
 *
 * Main UI: 12+ CAPAs in card grid, sortable by deadline/status.
 * Dark-first design with proper a11y, performance optimizations.
 */

import { useState, useMemo } from 'react';
import { useCAPAs } from '../hooks/useCAPAs';
import { useCAPADeadlineMonitor } from '../hooks/useCAPADeadlineMonitor';
import { CAPAStatusBadge } from './CAPAStatusBadge';
import { CAPADeadlineIndicator } from './CAPADeadlineIndicator';
import { CAPAEvidenceList } from './CAPAEvidenceList';
import { CAPAStatusTransitionModal } from './CAPAStatusTransitionModal';
import type { CAPAWithDeadlineStatus, CapaStateLegacy } from '../types';

/**
 * Single CAPA card component.
 */
function CAPACard({ capa }: { capa: CAPAWithDeadlineStatus }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showTransition, setShowTransition] = useState(false);

  const priorityColor: Record<string, string> = {
    'critica': 'border-l-4 border-red-500',
    'alta': 'border-l-4 border-amber-500',
    'media': 'border-l-4 border-yellow-500',
    'estendida': 'border-l-4 border-slate-500',
  };

  return (
    <>
      <div
        className={`
          bg-white/5 rounded-lg p-6 hover:bg-white/10 transition-colors duration-150
          ${priorityColor[capa.priority] || 'border-l-4 border-slate-500'}
          flex flex-col gap-4
        `}
      >
        {/* Header: NC ID + Priority Badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white">NC-{capa.id.slice(-3)}</h3>
            <p className="text-xs text-white/60 mt-1">{capa.dicqRef}</p>
          </div>
          <span
            className={`
              px-2 py-1 rounded text-xs font-medium whitespace-nowrap
              ${
                capa.priority === 'critica'
                  ? 'bg-red-500/20 text-red-200'
                  : capa.priority === 'alta'
                    ? 'bg-amber-500/20 text-amber-200'
                    : capa.priority === 'media'
                      ? 'bg-yellow-500/20 text-yellow-200'
                      : 'bg-slate-500/20 text-slate-200'
              }
            `}
          >
            {capa.priority.charAt(0).toUpperCase() + capa.priority.slice(1)}
          </span>
        </div>

        {/* Finding: 2 lines truncated */}
        <div>
          <p className="text-sm text-white/90 line-clamp-2 hover:line-clamp-none transition-all">
            {capa.finding.title}
          </p>
        </div>

        {/* Deadline Indicator */}
        <div>
          <CAPADeadlineIndicator
            deadline={capa.deadline}
            deadlineStatus={capa.deadlineStatus}
          />
        </div>

        {/* Status Badge */}
        <div>
          <CAPAStatusBadge status={capa.status as CapaStateLegacy} />
        </div>

        {/* Evidence Count + View Link */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={() => setShowEvidence(true)}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline"
            aria-label={`Ver ${capa.evidence.length} evidências`}
          >
            Evidências ({capa.evidence.length})
          </button>

          {/* Update Status Button */}
          {capa.status !== 'fechado' && (
            <button
              onClick={() => setShowTransition(true)}
              className="text-xs px-3 py-1 rounded bg-violet-600 hover:bg-violet-700 transition-colors font-medium"
              aria-label="Atualizar status"
            >
              Atualizar
            </button>
          )}
        </div>

        {/* Owner */}
        {capa.ownerName && (
          <div className="text-xs text-white/50">
            Responsável: {capa.ownerName}
          </div>
        )}
      </div>

      {/* Evidence Modal */}
      <CAPAEvidenceList
        evidence={capa.evidence}
        capaId={capa.id}
        isOpen={showEvidence}
        onClose={() => setShowEvidence(false)}
      />

      {/* Transition Modal */}
      <CAPAStatusTransitionModal
        capaId={capa.id}
        currentStatus={capa.status as CapaStateLegacy}
        isOpen={showTransition}
        onClose={() => setShowTransition(false)}
        onSubmit={async (toStatus, notes) => {
          // TODO: Call Cloud Function callable
          console.log('Transition', { capaId: capa.id, toStatus, notes });
        }}
      />
    </>
  );
}

/**
 * Main CAPA Dashboard view.
 */
export function CAPADashboard() {
  const { capas, loading, error } = useCAPAs();
  useCAPADeadlineMonitor(capas);

  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'status'>(
    'deadline',
  );

  // Compute sorted list
  const sortedCapas = useMemo(() => {
    const sorted = [...capas];

    if (sortBy === 'deadline') {
      sorted.sort((a, b) => {
        const aTime = a.deadline ?? 0;
        const bTime = b.deadline ?? 0;
        return aTime - bTime;
      });
    } else if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = { critica: 0, critical: 0, alta: 1, major: 1, media: 2, minor: 2, estendida: 3 };
      sorted.sort((a, b) => {
        const aIdx = priorityOrder[a.priority as string] ?? 3;
        const bIdx = priorityOrder[b.priority as string] ?? 3;
        return aIdx - bIdx;
      });
    } else if (sortBy === 'status') {
      const statusOrder: Record<CapaStateLegacy, number> = {
        'aberto': 0,
        'em-andamento': 1,
        'evidencia-submetida': 2,
        'auditor-revisando': 3,
        'fechado': 4,
      };
      sorted.sort((a, b) => {
        const aIdx = statusOrder[(a.status as CapaStateLegacy)] ?? 5;
        const bIdx = statusOrder[(b.status as CapaStateLegacy)] ?? 5;
        return aIdx - bIdx;
      });
    }

    return sorted;
  }, [capas, sortBy]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts: Record<CapaStateLegacy, number> = {
      'aberto': 0,
      'em-andamento': 0,
      'evidencia-submetida': 0,
      'auditor-revisando': 0,
      'fechado': 0,
    };
    capas.forEach((c) => {
      counts[(c.status as CapaStateLegacy)]++;
    });
    return counts;
  }, [capas]);

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">Erro ao carregar CAPAs: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141417] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Acompanhamento CAPA
        </h1>
        <p className="text-white/60">
          {capas.length} CAPAs de Phase 7 Audit Dry-Run
        </p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {(Object.keys(statusCounts) as Array<keyof typeof statusCounts>).map((status) => (
          <div
            key={status}
            className="bg-white/5 rounded-lg p-4 text-center"
          >
            <p className="text-2xl font-bold text-white">
              {statusCounts[status]}
            </p>
            <p className="text-xs text-white/60 mt-1 capitalize">
              {status.replace('-', ' ')}
            </p>
          </div>
        ))}
      </div>

      {/* Sort Controls */}
      <div className="mb-6 flex gap-4">
        <label htmlFor="sort-select" className="text-sm text-white/70">
          Ordenar por:
        </label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1 rounded-md bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="deadline">Deadline (próxima primeiro)</option>
          <option value="priority">Prioridade (crítica primeiro)</option>
          <option value="status">Status (aberto primeiro)</option>
        </select>
      </div>

      {/* CAPA Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-lg p-6 animate-pulse"
            >
              <div className="h-4 bg-white/10 rounded w-20 mb-4" />
              <div className="h-3 bg-white/10 rounded w-full mb-2" />
              <div className="h-3 bg-white/10 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedCapas.map((capa) => (
            <CAPACard key={capa.id} capa={capa} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && capas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/60">
            Nenhuma CAPA encontrada. Verifique se você tem acesso ao lab correto.
          </p>
        </div>
      )}
    </div>
  );
}
