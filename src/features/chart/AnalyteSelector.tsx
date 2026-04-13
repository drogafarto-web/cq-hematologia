import React from 'react';
import { ANALYTE_MAP } from '../../constants';
import type { ControlLot, WestgardViolation } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalyteSelectorProps {
  lot:                ControlLot;
  selectedAnalyteId:  string | null;
  onSelect:           (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the most recent value for a given analyte in the lot. */
function getLastValue(lot: ControlLot, analyteId: string): number | null {
  const sorted = [...lot.runs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  for (const run of sorted) {
    const result = run.results.find((r) => r.analyteId === analyteId);
    if (result !== undefined) return result.value;
  }
  return null;
}

/** Returns the most severe violation level for an analyte across recent runs. */
function getViolationLevel(lot: ControlLot, analyteId: string): 'rejection' | 'warning' | null {
  const recent = [...lot.runs]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  let hasWarning = false;

  for (const run of recent) {
    const result = run.results.find((r) => r.analyteId === analyteId);
    if (!result) continue;
    const rejectionViolations: WestgardViolation[] = ['1-3s', '2-2s', 'R-4s', '4-1s', '10x'];
    if (result.violations.some((v) => rejectionViolations.includes(v))) return 'rejection';
    if (result.violations.includes('1-2s')) hasWarning = true;
  }

  return hasWarning ? 'warning' : null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AnalyteSelector — compact grid of analyte buttons.
 *
 * Each button shows the analyte ID, its last measured value,
 * and a color indicator for the most recent Westgard status.
 */
export function AnalyteSelector({ lot, selectedAnalyteId, onSelect }: AnalyteSelectorProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
        Analito
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-7 gap-1.5">
        {lot.requiredAnalytes.map((id) => {
          const analyte    = ANALYTE_MAP[id];
          if (!analyte) return null;

          const lastValue  = getLastValue(lot, id);
          const violation  = getViolationLevel(lot, id);
          const isSelected = id === selectedAnalyteId;

          const statusDot =
            violation === 'rejection' ? 'bg-red-400' :
            violation === 'warning'   ? 'bg-amber-400' :
            lot.runs.length > 0       ? 'bg-emerald-400' :
                                        'bg-white/20';

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`
                relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl
                text-center transition-all border
                ${isSelected
                  ? 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                  : 'border-transparent bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.1] text-white/55 hover:text-white/80'}
              `}
            >
              {/* Status indicator */}
              <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${statusDot}`} />

              <span className="text-xs font-semibold leading-none">{analyte.id}</span>

              {lastValue !== null ? (
                <span className="text-[9px] leading-none opacity-60 font-mono">
                  {lastValue.toFixed(analyte.decimals)}
                </span>
              ) : (
                <span className="text-[9px] leading-none opacity-25">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
