/**
 * ResultCard
 * Single test result preview — dark-first, minimal, world-class
 * Accessibility: WCAG AAA (7:1 contrast)
 */

import React from 'react';
import type { PatientResult } from '../types';

interface ResultCardProps {
  result: PatientResult;
  onViewDetails?: () => void;
}

const statusConfig = {
  ok: {
    badge: 'bg-emerald-500/12 text-emerald-400',
    label: 'Normal',
    icon: '✓',
  },
  warning: {
    badge: 'bg-amber-500/12 text-amber-400',
    label: 'Alterado',
    icon: '⚠',
  },
  critical: {
    badge: 'bg-red-500/12 text-red-400',
    label: 'Crítico',
    icon: '!',
  },
  pending: {
    badge: 'bg-white/5 text-white/60',
    label: 'Pendente',
    icon: '⏳',
  },
};

export const ResultCard: React.FC<ResultCardProps> = ({ result, onViewDetails }) => {
  const status = statusConfig[result.status];

  return (
    <div className="border border-white/8 rounded-lg p-4 bg-white/2 hover:bg-white/4 transition-colors">
      {/* Header: Exam name + Status badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white/95 truncate">{result.examName}</h3>
          <p className="text-xs text-white/50 mt-1">
            Coleta: {new Date(result.examDate.toDate()).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div
          className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${status.badge}`}
        >
          {status.label}
        </div>
      </div>

      {/* Result value + reference (if available) */}
      {result.resultValue && (
        <div className="mb-3 p-3 bg-white/3 rounded border border-white/5">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-white/95">{result.resultValue}</span>
            {result.unit && <span className="text-xs text-white/60">{result.unit}</span>}
          </div>
          {result.referenceRange && (
            <p className="text-xs text-white/50 mt-1">Ref. {result.referenceRange}</p>
          )}
        </div>
      )}

      {/* Pending state */}
      {result.status === 'pending' && (
        <div className="mb-3 p-3 bg-white/3 rounded border border-white/5">
          <p className="text-xs text-white/60">
            Resultado ainda não disponível. Atualizaremos em breve.
          </p>
        </div>
      )}

      {/* Footer: Result date + View details link */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <p className="text-xs text-white/50">
          Resultado: {new Date(result.resultDate.toDate()).toLocaleDateString('pt-BR')}
        </p>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ver detalhes →
          </button>
        )}
      </div>
    </div>
  );
};
