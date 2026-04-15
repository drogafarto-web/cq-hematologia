import { useState, useMemo } from 'react';
import type { ControlLot, StatsSource } from '../../../types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Expanded stats with all reference-line values + CV pre-computed. */
export interface StatsWithCV {
  mean:     number;
  sd:       number;
  /** Coefficient of Variation (%) — 0 when mean is 0 */
  cv:       number;
  plus1sd:  number;
  minus1sd: number;
  plus2sd:  number;
  minus2sd: number;
  plus3sd:  number;
  minus3sd: number;
}

export interface UseStatsByModeReturn {
  mode:                 StatsSource;
  setMode:              (m: StatsSource) => void;

  /** Stats driving chart reference lines and the stats panel */
  activeStats:          StatsWithCV | null;
  /** Manufacturer-supplied stats (always from lot.manufacturerStats) */
  manufacturerStats:    StatsWithCV | null;
  /** Internal stats computed live from approved runs (sample SD, ISO 5725) */
  internalStats:        StatsWithCV | null;

  /** Number of approved run-values for the selected analyte */
  approvedRuns:         number;
  /** true when ≥ 2 approved values exist — minimum for sample SD */
  hasEnoughForInternal: boolean;
  /** true when internal stats are currently the active source */
  isUsingInternalStats: boolean;
  /**
   * Non-null warning string when internal stats are active but n < 20.
   * ISO 5725 / CLSI EP05 recommend ≥ 20 values for stable estimates.
   */
  warning:              string | null;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Sample standard deviation (Bessel-corrected, N-1 denominator).
 * Returns null when n < 2 (SD is undefined with fewer than 2 values).
 */
function computeSampleStats(
  values: number[]
): { mean: number; sd: number } | null {
  const n = values.length;
  if (n < 2) return null;

  const mean     = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance) };
}

/** Expands mean + SD into all reference-line values plus CV. */
function expand(raw: { mean: number; sd: number }): StatsWithCV {
  const { mean, sd } = raw;
  return {
    mean,
    sd,
    cv:       mean === 0 ? 0 : (sd / mean) * 100,
    plus1sd:  mean + sd,
    minus1sd: mean - sd,
    plus2sd:  mean + 2 * sd,
    minus2sd: mean - 2 * sd,
    plus3sd:  mean + 3 * sd,
    minus3sd: mean - 3 * sd,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useStatsByMode — manages the Fabricante / Interna toggle state and
 * derives all statistics needed by the chart panel and toggle component.
 *
 * Internal stats are computed LIVE from the lot's approved runs using
 * sample SD (N-1 denominator, per ISO 5725 / CLSI EP05).
 * The "Interna" option is enabled as soon as n ≥ 2; a warning is shown
 * when n < 20 to flag that estimates are still preliminary.
 *
 * @param lot        Active ControlLot
 * @param analyteId  Currently selected analyte
 */
export function useStatsByMode(
  lot:       ControlLot | null,
  analyteId: string | null,
): UseStatsByModeReturn {
  const [mode, setMode] = useState<StatsSource>('manufacturer');

  const derived = useMemo(() => {
    if (!lot || !analyteId) {
      return {
        activeStats:          null,
        manufacturerStats:    null,
        internalStats:        null,
        approvedRuns:         0,
        hasEnoughForInternal: false,
        isUsingInternalStats: false,
        warning:              null,
      };
    }

    // ── Manufacturer stats ───────────────────────────────────────────────────
    const mfrRaw          = lot.manufacturerStats[analyteId] ?? null;
    const manufacturerStats = mfrRaw ? expand(mfrRaw) : null;

    // ── Internal stats (live, sample SD) ────────────────────────────────────
    const approvedValues = lot.runs
      .filter((r) => r.status === 'Aprovada')
      .flatMap((r) => r.results.filter((res) => res.analyteId === analyteId))
      .map((res) => res.value);

    const approvedRuns         = approvedValues.length;
    const hasEnoughForInternal = approvedRuns >= 2;
    const intRaw               = computeSampleStats(approvedValues);
    const internalStats        = intRaw ? expand(intRaw) : null;

    // ── Active source resolution ─────────────────────────────────────────────
    const isUsingInternalStats = mode === 'internal' && hasEnoughForInternal;
    const activeStats          = isUsingInternalStats ? internalStats : manufacturerStats;

    const warning = isUsingInternalStats && approvedRuns < 20
      ? `Estatísticas preliminares — n = ${approvedRuns} (recomendado ≥ 20)`
      : null;

    return {
      activeStats,
      manufacturerStats,
      internalStats,
      approvedRuns,
      hasEnoughForInternal,
      isUsingInternalStats,
      warning,
    };
  }, [lot, analyteId, mode]);

  return { ...derived, mode, setMode };
}
