import React, { useMemo } from 'react';
import type { CoagulacaoLot } from '../types/Coagulacao';
import type { CoagNivel } from '../types/_shared_refs';
import { COAG_NIVEIS } from '../utils/currentCompetence';
import { findCurrentLotByNivel, getCurrentCompetenceMonth } from '../utils/currentCompetence';
import { formatCoagNivelLabel } from '../utils/coagNivelLabels';

interface CoagLevelPillsProps {
  lots: CoagulacaoLot[];
  activeLot: CoagulacaoLot | null;
  onSelectLot: (id: string) => void;
  /** Nível sem lote no período — abre nova corrida (como slot vazio na sidebar anterior). */
  onSelectEmptyNivel: (nivel: CoagNivel) => void;
}

/**
 * Pills de nível — paridade com `LevelPills` em `AnaliseScreen` (hematologia).
 * Sempre mostra Nível I e Nível II.
 */
export function CoagLevelPills({
  lots,
  activeLot,
  onSelectLot,
  onSelectEmptyNivel,
}: CoagLevelPillsProps) {
  const competence = useMemo(() => getCurrentCompetenceMonth(lots), [lots]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500 dark:text-white/40 mr-1">Nível:</span>
      {COAG_NIVEIS.map((nivel) => {
        const lot = findCurrentLotByNivel(lots, nivel);
        const isActive = lot ? activeLot?.id === lot.id : activeLot?.nivel === nivel && !lot;
        const hasLot = lot != null;

        return (
          <button
            key={nivel}
            type="button"
            onClick={() => {
              if (lot) onSelectLot(lot.id);
              else onSelectEmptyNivel(nivel);
            }}
            title={
              hasLot
                ? `${formatCoagNivelLabel(nivel)} · ${lot.loteControle}`
                : `${formatCoagNivelLabel(nivel)} — sem lote em ${competence.label}`
            }
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              isActive
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-500/25'
                : hasLot
                  ? 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-white/60 hover:border-rose-200 dark:hover:border-rose-500/30'
                  : 'bg-white dark:bg-white/[0.02] border-dashed border-slate-200 dark:border-white/[0.08] text-slate-400 dark:text-white/35 hover:border-rose-200 dark:hover:border-rose-500/25',
            ].join(' ')}
          >
            {formatCoagNivelLabel(nivel)}
            {!hasLot && <span className="ml-1.5 text-[10px] font-normal opacity-80">+</span>}
          </button>
        );
      })}
      <span className="text-[11px] text-slate-400 dark:text-white/30 capitalize ml-1 tabular-nums">
        {competence.label}
      </span>
    </div>
  );
}
