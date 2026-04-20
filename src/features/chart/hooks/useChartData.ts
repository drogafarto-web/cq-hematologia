import { useMemo } from 'react';
import { checkWestgardRules, isRejection, isWarningOnly } from '../utils/westgardRules';
import { MIN_RUNS_FOR_INTERNAL_STATS } from '../../../constants';
import type {
  ControlLot,
  Run,
  RunStatus,
  WestgardViolation,
  AnalyteStats,
  StatsSource,
} from '../../../types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** One point in the Recharts dataset — maps to a single run × analyte pair. */
export interface ChartPoint {
  /** 1-based sequence number (X axis label) */
  index: number;
  runId: string;
  sampleId: string | undefined;
  timestamp: Date;
  /** null when this run has no result for the selected analyte */
  value: number | null;
  status: RunStatus;
  /** Recalculated from the active stats source (may differ from stored violations) */
  violations: WestgardViolation[];
  isRejection: boolean;
  isWarningOnly: boolean;
  /** (value − mean) / sd; null when value is null */
  zScore: number | null;
}

/** Expanded stats with all reference-line values pre-computed. */
export interface ChartStats {
  mean: number;
  sd: number;
  plus1sd: number;
  minus1sd: number;
  plus2sd: number;
  minus2sd: number;
  plus3sd: number;
  minus3sd: number;
}

/** A single active Westgard rule violation ready to display in an alert panel. */
export interface WestgardAlert {
  runId: string;
  /** 1-based index of the run in the chart */
  runIndex: number;
  violation: WestgardViolation;
  isRejection: boolean;
  value: number;
  timestamp: Date;
}

export interface UseChartDataReturn {
  /** Data array for Recharts <LineChart data={chartData}> */
  chartData: ChartPoint[];

  /**
   * Stats currently used for reference lines and violation calculations.
   * Reflects statsSource selection; falls back to manufacturer when internal
   * stats are not yet available.
   */
  currentStats: ChartStats | null;

  /** Manufacturer stats, always shown as a secondary reference if available */
  manufacturerStats: ChartStats | null;

  /** true when the lot has ≥ 2 approved run-values for the selected analyte */
  hasEnoughData: boolean;

  /** true when currentStats is derived from internal (calculated) statistics */
  isUsingInternalStats: boolean;

  /** true when manufacturer stats are defined for this analyte */
  isBaselineEstablished: boolean;

  /**
   * All violations across the entire series, chronological.
   * Component can slice/filter to show recent alerts or a summary.
   */
  westgardAlerts: WestgardAlert[];

  /** Total runs that have a result for the selected analyte */
  totalRuns: number;

  /** Approved runs that have a result for the selected analyte */
  approvedRuns: number;

  /** How many more approved runs are needed to establish internal stats */
  runsUntilBaseline: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Expands mean + SD into all reference-line values for the chart. */
function toChartStats({ mean, sd }: AnalyteStats): ChartStats {
  return {
    mean,
    sd,
    plus1sd: mean + sd,
    minus1sd: mean - sd,
    plus2sd: mean + 2 * sd,
    minus2sd: mean - 2 * sd,
    plus3sd: mean + 3 * sd,
    minus3sd: mean - 3 * sd,
  };
}

/**
 * Applies Westgard rules to the full run series in chronological order.
 *
 * Iterates oldest → newest, maintaining a newest-first history buffer so
 * `checkWestgardRules` can evaluate multi-point rules correctly.
 *
 * Returns a Map<runId, violations[]> for O(1) lookup during chart build.
 */
function buildViolationMap(
  sortedRuns: Run[],
  analyteId: string,
  stats: AnalyteStats,
): Map<string, WestgardViolation[]> {
  const map = new Map<string, WestgardViolation[]>();
  const history: number[] = []; // newest-first window (max 10 used by 10x rule)

  for (const run of sortedRuns) {
    const result = run.results.find((r) => r.analyteId === analyteId);

    if (!result) {
      map.set(run.id, []);
      continue;
    }

    const violations = checkWestgardRules(result.value, history, stats);
    map.set(run.id, violations);

    // Prepend so the next iteration sees this value as "previous[0]"
    history.unshift(result.value);
    if (history.length > 10) history.pop(); // cap at the 10x rule window
  }

  return map;
}

// ─── Internal sample-SD helper ────────────────────────────────────────────────

/**
 * Computes sample mean + SD (Bessel-corrected, N-1 denominator per ISO 5725).
 * Returns null when fewer than 2 values are available.
 */
function computeSampleStats(values: number[]): AnalyteStats | null {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, sd: Math.sqrt(variance) };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useChartData — pure derivation hook for the Levey-Jennings chart.
 *
 * No side effects. No persistence calls. No internal setState.
 * All outputs are derived synchronously inside a single useMemo.
 *
 * Internal statistics are computed LIVE from approved runs using sample SD
 * (N-1, ISO 5725 / CLSI EP05) — not from the cached lot.statistics field.
 * This ensures the chart is always consistent with the current run set.
 * The "Interna" source is available as soon as n ≥ 2 approved values exist.
 *
 * @param lot         Active ControlLot (source of runs + stats)
 * @param analyteId   Analyte currently selected in the chart
 * @param statsSource Which stats baseline to use for violation calculations
 */
export function useChartData(
  lot: ControlLot | null,
  analyteId: string | null,
  statsSource: StatsSource,
): UseChartDataReturn {
  return useMemo<UseChartDataReturn>(() => {
    // ── Empty state ──────────────────────────────────────────────────────────
    const empty: UseChartDataReturn = {
      chartData: [],
      currentStats: null,
      manufacturerStats: null,
      hasEnoughData: false,
      isUsingInternalStats: false,
      isBaselineEstablished: false,
      westgardAlerts: [],
      totalRuns: 0,
      approvedRuns: 0,
      runsUntilBaseline: MIN_RUNS_FOR_INTERNAL_STATS,
    };

    if (!lot || !analyteId) return empty;

    // ── Resolve statistics ───────────────────────────────────────────────────
    const mfrRaw = lot.manufacturerStats[analyteId] ?? null;

    // Compute internal stats LIVE from approved runs (sample SD, N-1).
    // Using lot.statistics (cached) would be stale; computing here ensures
    // the chart always reflects the exact current run set.
    const approvedValues = lot.runs
      .filter((r) => r.status === 'Aprovada')
      .flatMap((r) => r.results.filter((res) => res.analyteId === analyteId))
      .map((res) => res.value);

    const intRaw = computeSampleStats(approvedValues); // null when n < 2

    const isBaselineEstablished = mfrRaw !== null;
    const hasEnoughData = intRaw !== null; // enabled at n ≥ 2
    const isUsingInternalStats = statsSource === 'internal' && hasEnoughData;

    // Active stats: prefer internal when selected and available, else manufacturer
    const activeRaw: AnalyteStats | null = isUsingInternalStats ? intRaw : mfrRaw;

    // Cannot draw a chart without at least one set of stats
    if (!activeRaw) return { ...empty, isBaselineEstablished };

    const currentStats = toChartStats(activeRaw);
    const manufacturerStats = mfrRaw ? toChartStats(mfrRaw) : null;

    // ── Sort runs chronologically ────────────────────────────────────────────
    const sortedRuns = [...lot.runs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // ── Violation map (recalculated against active stats source) ─────────────
    const violationMap = buildViolationMap(sortedRuns, analyteId, activeRaw);

    // ── Build chart data + alert list ────────────────────────────────────────
    const chartData: ChartPoint[] = [];
    const westgardAlerts: WestgardAlert[] = [];

    let totalRuns = 0;
    let approvedRuns = 0;

    sortedRuns.forEach((run, idx) => {
      const result = run.results.find((r) => r.analyteId === analyteId);
      const value = result?.value ?? null;
      const violations = violationMap.get(run.id) ?? [];
      const rejected = isRejection(violations);
      const warning = isWarningOnly(violations);
      const zScore = value !== null ? (value - activeRaw.mean) / activeRaw.sd : null;

      if (value !== null) {
        totalRuns++;
        if (run.status === 'Aprovada') approvedRuns++;
      }

      chartData.push({
        index: idx + 1,
        runId: run.id,
        sampleId: run.sampleId,
        timestamp: run.timestamp,
        value,
        status: run.status,
        violations,
        isRejection: rejected,
        isWarningOnly: warning,
        zScore,
      });

      // Collect all violations for the alert panel
      for (const violation of violations) {
        if (value !== null) {
          westgardAlerts.push({
            runId: run.id,
            runIndex: idx + 1,
            violation,
            isRejection: isRejection([violation]),
            value,
            timestamp: run.timestamp,
          });
        }
      }
    });

    const runsUntilBaseline = Math.max(0, MIN_RUNS_FOR_INTERNAL_STATS - approvedRuns);

    return {
      chartData,
      currentStats,
      manufacturerStats,
      hasEnoughData,
      isUsingInternalStats,
      isBaselineEstablished,
      westgardAlerts,
      totalRuns,
      approvedRuns,
      runsUntilBaseline,
    };

    // Intentionally depend on `lot` reference (Zustand immutable updates guarantee
    // a new reference whenever any nested field changes).
  }, [lot, analyteId, statsSource]);
}
