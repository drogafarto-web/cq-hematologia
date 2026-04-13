import React from 'react';
import { MIN_RUNS_FOR_INTERNAL_STATS } from '../../constants';
import type { StatsSource } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatsSourceToggleProps {
  value:          StatsSource;
  onChange:       (v: StatsSource) => void;
  hasEnoughData:  boolean;
  approvedRuns:   number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StatsSourceToggle — switches between manufacturer and internal statistics.
 *
 * The "Internal" option is disabled until the lot has enough approved runs
 * to compute stable statistics (MIN_RUNS_FOR_INTERNAL_STATS).
 */
export function StatsSourceToggle({
  value,
  onChange,
  hasEnoughData,
  approvedRuns,
}: StatsSourceToggleProps) {
  const runsLeft = Math.max(0, MIN_RUNS_FOR_INTERNAL_STATS - approvedRuns);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
        Estatísticas
      </p>

      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
        {/* Manufacturer */}
        <button
          type="button"
          onClick={() => onChange('manufacturer')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'manufacturer'
              ? 'bg-white/[0.1] text-white/90 shadow-sm'
              : 'text-white/40 hover:text-white/65'
          }`}
        >
          Fabricante
        </button>

        {/* Internal */}
        <button
          type="button"
          disabled={!hasEnoughData}
          onClick={() => hasEnoughData && onChange('internal')}
          title={!hasEnoughData ? `Faltam ${runsLeft} corrida${runsLeft > 1 ? 's' : ''} aprovadas para habilitar` : undefined}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === 'internal'
              ? 'bg-violet-500/20 text-violet-300'
              : hasEnoughData
              ? 'text-white/40 hover:text-white/65'
              : 'text-white/20 cursor-not-allowed'
          }`}
        >
          Interna
        </button>
      </div>

      {/* Progress hint when internal not yet available */}
      {!hasEnoughData && (
        <div className="space-y-1.5">
          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500/60 transition-all"
              style={{ width: `${(approvedRuns / MIN_RUNS_FOR_INTERNAL_STATS) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-white/25">
            {approvedRuns}/{MIN_RUNS_FOR_INTERNAL_STATS} corridas aprovadas para stats internas
          </p>
        </div>
      )}
    </div>
  );
}
