/**
 * CAPADetailPanel.tsx — SA-28
 *
 * Side panel showing CAPA details: finding, evidence, RFI log, state history.
 * Dark-first design with sections for evidence and timeline.
 */

import { useState, useMemo } from 'react';
import { useCAPAs } from '../hooks/useCAPAs';

interface CAPADetailPanelProps {
  capaId: string;
  onBack: () => void;
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 2v4m0 12v4" />
    </svg>
  );
}

export function CAPADetailPanel({ capaId, onBack }: CAPADetailPanelProps) {
  const { capas, loading } = useCAPAs();

  const capa = useMemo(() => {
    return capas.find((c) => c.id === capaId);
  }, [capas, capaId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white/2 border-l border-white/10 p-6">
        <div className="h-6 bg-slate-700/40 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-700/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!capa) {
    return (
      <div className="flex flex-col h-full bg-white/2 border-l border-white/10 p-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 mb-6 transition-colors"
        >
          <ArrowIcon />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">CAPA não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/2 border-l border-white/10 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 p-6 border-b border-white/10 bg-white/3 backdrop-blur">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 mb-4 transition-colors"
        >
          <ArrowIcon />
          <span className="text-sm font-medium">Voltar</span>
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Detalhe da CAPA
            </h2>
            <p className="text-xs text-slate-400 mt-1">ID: {capa.id.slice(-6)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* State History */}
        {capa.stateHistory && capa.stateHistory.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Histórico de estados
            </h3>
            <div className="space-y-2">
              {[...capa.stateHistory].reverse().map((transition, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <TimelineIcon />
                  <div className="flex-1 pt-0.5">
                    <p className="text-slate-200 font-medium">
                      Estado atualizado
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      por {transition.transitionedBy}
                    </p>
                    <p className="text-slate-500 text-[10px]">
                      {new Date(typeof transition.transitionedAt === 'number' ? transition.transitionedAt : (transition.transitionedAt as any)?.toMillis?.()).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!capa.stateHistory || capa.stateHistory.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">Nenhum histórico de estado disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}
