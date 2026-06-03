import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useRuns } from './useRuns';
import { useInternalStats } from './useInternalStats';
import { calcZScore } from '../utils/statsHelpers';
import { checkWestgardCLSI, WestgardViolation } from '../utils/westgardRulesCLSI';
import { Run } from '../types';

export interface ChartPoint {
  runId: string;
  capturaEm: Timestamp;
  value: number;
  zScore: number;
  violations: WestgardViolation[];
}

export interface ChartLine {
  y: number;
  label: '+3σ' | '+2σ' | '+1σ' | 'mean' | '-1σ' | '-2σ' | '-3σ';
}

export interface ChartDataResult {
  points: ChartPoint[];
  mean: number;
  sd: number;
  lines: ChartLine[];
  isInternalReady: boolean;
  statsSource: 'manufacturer' | 'internal';
}

type StatsSource = 'manufacturer' | 'internal';

export function useChartData(
  labId: string,
  equipmentId: string,
  analitoId: string,
  nivelId: string,
  manufacturerStats: { mean: number; sd: number } | null,
  statsSource: StatsSource = 'manufacturer',
): ChartDataResult {
  const { runs } = useRuns(labId, { equipmentId });
  const internalStatsResult = useInternalStats(labId, equipmentId, analitoId, nivelId);

  return useMemo(() => {
    // Determine which stats to use
    const useInternal = statsSource === 'internal' && internalStatsResult.available;
    const activeStats =
      useInternal && internalStatsResult.stats ? internalStatsResult.stats : manufacturerStats;

    if (!activeStats || !Number.isFinite(activeStats.mean) || activeStats.sd <= 0) {
      return {
        points: [],
        mean: NaN,
        sd: NaN,
        lines: [],
        isInternalReady: internalStatsResult.available,
        statsSource: useInternal ? 'internal' : 'manufacturer',
      };
    }

    // Filter runs for this analito × nível × equipamento
    const relevantRuns = runs.filter(
      (run) =>
        run.equipmentId === equipmentId && run.resultados?.[analitoId]?.[nivelId] !== undefined,
    );

    // Convert to chart points
    const points = relevantRuns.map((run) => {
      const value = run.resultados[analitoId][nivelId];
      const zScore = calcZScore(value, activeStats);

      // Check for Westgard violations
      const history = relevantRuns
        .filter((r) => r.criadoEm.toMillis() < run.criadoEm.toMillis())
        .sort((a, b) => b.criadoEm.toMillis() - a.criadoEm.toMillis())
        .slice(0, 1)
        .map((r) => ({
          value: r.resultados[analitoId][nivelId],
          capturaEm: r.criadoEm,
        }));

      const violations = checkWestgardCLSI({
        current: {
          value,
          analitoId,
          nivelId,
          equipmentId,
          capturaEm: run.criadoEm,
        },
        history,
        stats: activeStats,
      });

      return {
        runId: run.id,
        capturaEm: run.criadoEm,
        value,
        zScore,
        violations,
      } as ChartPoint;
    });

    // Generate reference lines
    const lines: ChartLine[] = [
      { y: activeStats.mean - 3 * activeStats.sd, label: '-3σ' },
      { y: activeStats.mean - 2 * activeStats.sd, label: '-2σ' },
      { y: activeStats.mean - activeStats.sd, label: '-1σ' },
      { y: activeStats.mean, label: 'mean' },
      { y: activeStats.mean + activeStats.sd, label: '+1σ' },
      { y: activeStats.mean + 2 * activeStats.sd, label: '+2σ' },
      { y: activeStats.mean + 3 * activeStats.sd, label: '+3σ' },
    ];

    return {
      points,
      mean: activeStats.mean,
      sd: activeStats.sd,
      lines,
      isInternalReady: internalStatsResult.available,
      statsSource: useInternal ? 'internal' : 'manufacturer',
    };
  }, [runs, equipmentId, analitoId, nivelId, manufacturerStats, statsSource, internalStatsResult]);
}
