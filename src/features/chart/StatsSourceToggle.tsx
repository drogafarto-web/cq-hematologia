import React from 'react';
import type { StatsSource } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatsSourceToggleProps {
  value: StatsSource;
  onChange: (v: StatsSource) => void;
  /** true when ≥ 2 approved run-values exist (minimum for sample SD) */
  hasEnoughForInternal: boolean;
  approvedRuns: number;
  /** Warning shown when internal stats are active but n < 20 */
  warning?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RECOMMENDED_RUNS = 20;

/**
 * StatsSourceToggle — switches between manufacturer and internal statistics.
 *
 * "Interna" becomes available as soon as ≥ 2 approved runs exist.
 * A warning banner is shown when n < 20 (ISO 5725 recommendation).
 */
export function StatsSourceToggle({
  value,
  onChange,
  hasEnoughForInternal,
  approvedRuns,
  warning,
}: StatsSourceToggleProps) {
  const runsLeft = Math.max(0, RECOMMENDED_RUNS - approvedRuns);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-400 dark:text-white/40 uppercase tracking-wider">
        Estatísticas
      </p>

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] transition-colors duration-300">
        {/* Fabricante */}
        <button
          type="button"
          onClick={() => onChange('manufacturer')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'manufacturer'
              ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white/90 shadow-sm'
              : 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/65'
          }`}
        >
          Fabricante
        </button>

        {/* Interna */}
        <button
          type="button"
          disabled={!hasEnoughForInternal}
          onClick={() => hasEnoughForInternal && onChange('internal')}
          title={!hasEnoughForInternal ? 'Mínimo de 2 corridas aprovadas necessário' : undefined}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'internal'
              ? 'bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300'
              : hasEnoughForInternal
                ? 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/65'
                : 'text-slate-300 dark:text-white/20 cursor-not-allowed'
          }`}
        >
          Interna
        </button>
      </div>

      {/* Progress toward recommended 20 runs */}
      {approvedRuns < RECOMMENDED_RUNS && (
        <div className="space-y-1.5">
          <progress
            className="stats-progress"
            max={RECOMMENDED_RUNS}
            value={approvedRuns}
            aria-label={`${approvedRuns} de ${RECOMMENDED_RUNS} corridas aprovadas`}
          />
          <p className="text-[10px] text-slate-400 dark:text-white/25">
            {approvedRuns}/{RECOMMENDED_RUNS} corridas aprovadas
            {!hasEnoughForInternal && ` — mín. 2 para habilitar`}
            {hasEnoughForInternal && runsLeft > 0 && ` — +${runsLeft} p/ stats estáveis`}
          </p>
        </div>
      )}

      {/* Warning: internal active but n < 20 */}
      {warning && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 mt-px text-amber-400"
            aria-hidden
          >
            <path
              d="M6 1L1 10h10L6 1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M6 5v2.5M6 9v.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-[10px] text-amber-400/80 leading-relaxed">{warning}</p>
        </div>
      )}
    </div>
  );
}
