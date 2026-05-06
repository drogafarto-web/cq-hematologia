import { useMemo } from 'react';
import { useRuns } from './useRuns';
import { calcMeanSdBessel } from '../utils/statsHelpers';

export interface InternalStatsResult {
  stats: { mean: number; sd: number } | null;
  n: number;
  available: boolean;
  progress: number; // 0-1: X/20 progress if not yet ready
}

const INTERNAL_STATS_THRESHOLD = 20;

export function useInternalStats(
  labId: string,
  equipmentId: string,
  analitoId: string,
  nivelId: string
): InternalStatsResult {
  const { runs } = useRuns(labId, { equipmentId });

  return useMemo(() => {
    // Filter runs for this specific analito × nível × equipamento with "oficial" approval
    const relevantRuns = runs.filter(
      (run) =>
        run.equipmentId === equipmentId &&
        run.aproveitamento === 'oficial' &&
        run.resultados?.[analitoId]?.[nivelId] !== undefined
    );

    if (relevantRuns.length === 0) {
      return {
        stats: null,
        n: 0,
        available: false,
        progress: 0,
      };
    }

    // Extract values in chronological order (oldest first) and take last N=20
    const values = relevantRuns
      .slice(-INTERNAL_STATS_THRESHOLD)
      .map((run) => run.resultados[analitoId][nivelId] as number)
      .filter((v): v is number => typeof v === 'number');

    const result = calcMeanSdBessel(values);

    const available = values.length >= INTERNAL_STATS_THRESHOLD;
    const progress = Math.min(1, values.length / INTERNAL_STATS_THRESHOLD);

    return {
      stats: available ? { mean: result.mean, sd: result.sd } : null,
      n: values.length,
      available,
      progress,
    };
  }, [runs, equipmentId, analitoId, nivelId]);
}
