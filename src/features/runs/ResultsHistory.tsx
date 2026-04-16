import React, { useState } from 'react';
import { RunItem } from './RunItem';
import type { Run, RunStatus } from '../../types';

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type Filter = 'all' | RunStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',       label: 'Todas'     },
  { id: 'Aprovada',  label: 'Aprovadas' },
  { id: 'Rejeitada', label: 'Rejeitadas' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ResultsHistoryProps {
  runs:      Run[];
  lotId:     string;
  onDelete:  (lotId: string, runId: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResultsHistory({ runs, lotId, onDelete }: ResultsHistoryProps) {
  const [filter,    setFilter]    = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState(false);

  // Sort newest first
  const sorted = [...runs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const filtered = filter === 'all'
    ? sorted
    : sorted.filter((r) => r.status === filter);

  const rejectedCount = runs.filter((r) => r.status === 'Rejeitada').length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.01] overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
      {/* Header — min-height 44px para touch target adequado */}
      <div
        className="flex items-center gap-3 px-4 min-h-[44px] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
        onClick={() => setCollapsed((v) => !v)}
        role="button"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expandir histórico de corridas' : 'Recolher histórico de corridas'}
      >
        <div className="flex-1 flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-600 dark:text-white/70">Histórico de Corridas</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-white/40 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
              {runs.length}
            </span>
            {rejectedCount > 0 && (
              <span className="text-xs font-medium text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded-full">
                {rejectedCount} rejeitada{rejectedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
          className={`text-slate-400 dark:text-white/30 transition-transform ${collapsed ? 'rotate-180' : ''}`}
        >
          <path d="M3 9l4-4 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!collapsed && (
        <>
          {/* Filter tabs */}
          {runs.length > 0 && (
            <div className="flex gap-0 px-4 border-t border-b border-slate-100 dark:border-white/[0.05]" role="group" aria-label="Filtrar corridas">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`px-4 min-h-[44px] text-sm font-medium transition-all relative ${
                    filter === f.id ? 'text-slate-900 dark:text-white/80' : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/55'
                  }`}
                >
                  {f.label}
                  {filter === f.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-px bg-violet-500/50 dark:bg-white/40 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="p-3 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400 dark:text-white/30">
                  {runs.length === 0
                    ? 'Nenhuma corrida registrada ainda'
                    : 'Nenhuma corrida com este filtro'}
                </p>
              </div>
            ) : (
              filtered.map((run, i) => (
                <RunItem
                  key={run.id}
                  run={run}
                  index={filtered.length - i}
                  onDelete={(runId) => onDelete(lotId, runId)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
