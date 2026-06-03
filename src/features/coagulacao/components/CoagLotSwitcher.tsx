import React, { useMemo, useState } from 'react';
import type { CoagulacaoLot } from '../types/Coagulacao';
import {
  getCurrentCompetenceMonth,
  lotCompetenceKey,
  selectCurrentCompetenceLots,
} from '../utils/currentCompetence';
import { formatCoagNivelLabel } from '../utils/coagNivelLabels';

interface CoagLotSwitcherProps {
  lots: CoagulacaoLot[];
  activeLot: CoagulacaoLot | null;
  onSelect: (id: string) => void;
}

/**
 * Seletor de lote em uso — paridade com `LotSwitcher` da hematologia (topbar).
 * Exibe Nível I / Nível II e o mês de competência do período corrente.
 */
export function CoagLotSwitcher({ lots, activeLot, onSelect }: CoagLotSwitcherProps) {
  const [open, setOpen] = useState(false);

  const currentLots = useMemo(
    () => [...selectCurrentCompetenceLots(lots)].sort((a, b) => a.nivel.localeCompare(b.nivel)),
    [lots],
  );

  const competence = useMemo(() => getCurrentCompetenceMonth(lots), [lots]);

  const monthLabel = useMemo(() => {
    if (!activeLot) return competence.label;
    const key = lotCompetenceKey(activeLot);
    if (!key) return competence.label;
    const [y, m] = key.split('-');
    const ref = new Date(Number(y), Number(m) - 1, 1);
    return ref.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }, [activeLot, competence.label]);

  if (currentLots.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] text-xs text-slate-400 dark:text-white/35">
        Sem lote no período · {competence.label}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] hover:border-rose-300 dark:hover:border-rose-500/30 transition-all text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          Em uso
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-white/85">
          {activeLot ? formatCoagNivelLabel(activeLot.nivel) : '—'}
        </span>
        <span className="text-xs text-slate-400 dark:text-white/40 capitalize">{monthLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute left-0 top-full mt-1 z-30 min-w-[220px] rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.10] shadow-xl overflow-hidden py-1"
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Período corrente
              </p>
              <p className="text-xs text-slate-500 dark:text-white/45 capitalize mt-0.5">
                {competence.label}
              </p>
            </div>
            {currentLots.map((lot) => {
              const isActive = lot.id === activeLot?.id;
              return (
                <button
                  key={lot.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(lot.id);
                    setOpen(false);
                  }}
                  className={[
                    'w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-2',
                    isActive
                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300'
                      : 'text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/[0.05]',
                  ].join(' ')}
                >
                  <span className="font-medium">{formatCoagNivelLabel(lot.nivel)}</span>
                  <span className="font-mono text-[10px] text-slate-400 dark:text-white/35 truncate max-w-[100px]">
                    {lot.loteControle}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
