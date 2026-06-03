/**
 * useCriticosThresholds
 *
 * Fetches and mutates critical-value thresholds via server-side callables
 * (RDC 978/2025 Art. 167 — RT/admin/owner only writes).
 *
 * Wire:
 *   - read   → criticosConfig_getThresholds   (any active lab member)
 *   - create → criticosConfig_createThreshold (RT/admin/owner)
 *   - update → criticosConfig_updateThreshold (RT/admin/owner)
 *
 * Returns plain objects (not Firestore Timestamps) — the callables already
 * serialize criadoEm/atualizadoEm/deletadoEm as Date/null.
 */

import { useCallback, useEffect, useState } from 'react';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

export type AgeGroup = 'ALL' | 'NEONATE' | 'INFANT' | 'CHILD' | 'ADOLESCENT' | 'ADULT' | 'ELDERLY';

export type Sex = 'M' | 'F' | 'ALL';

/** Threshold record returned by the callable (server-shaped). */
export interface CriticosThresholdRecord {
  id: string;
  labId: string;
  analyteId: string;
  analyteName: string;
  lowThreshold: number | null;
  highThreshold: number | null;
  panicLow: number | null;
  panicHigh: number | null;
  unit: string;
  ageGroup: AgeGroup;
  sex: Sex;
  notas: string | null;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
  deletadoEm: Date | string | null;
}

export interface CreateThresholdInput {
  analyteId: string;
  analyteName: string;
  unit: string;
  ageGroup: AgeGroup;
  sex: Sex;
  lowThreshold?: number;
  highThreshold?: number;
  panicLow?: number;
  panicHigh?: number;
  notas?: string;
}

export interface UpdateThresholdInput {
  thresholdId: string;
  unit?: string;
  lowThreshold?: number | null;
  highThreshold?: number | null;
  panicLow?: number | null;
  panicHigh?: number | null;
  notas?: string | null;
}

interface GetThresholdsResponse {
  items: CriticosThresholdRecord[];
  count: number;
}

const callGet = httpsCallable<{ labId: string; includeDeleted?: boolean }, GetThresholdsResponse>(
  functions,
  'criticosConfig_getThresholds',
);

const callCreate = httpsCallable<Record<string, unknown>, CriticosThresholdRecord>(
  functions,
  'criticosConfig_createThreshold',
);

const callUpdate = httpsCallable<Record<string, unknown>, CriticosThresholdRecord>(
  functions,
  'criticosConfig_updateThreshold',
);

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export interface UseCriticosThresholdsResult {
  thresholds: CriticosThresholdRecord[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: CreateThresholdInput) => Promise<CriticosThresholdRecord>;
  update: (input: UpdateThresholdInput) => Promise<CriticosThresholdRecord>;
}

export function useCriticosThresholds(): UseCriticosThresholdsResult {
  const labId = useActiveLabId();
  const [thresholds, setThresholds] = useState<CriticosThresholdRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!labId) {
      setThresholds([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await callGet({ labId });
      const items = res.data?.items ?? [];
      // Sort: analyte name asc, then ageGroup, then sex — deterministic for UI.
      const sorted = [...items].sort((a, b) => {
        const n = a.analyteName.localeCompare(b.analyteName, 'pt-BR');
        if (n !== 0) return n;
        const g = a.ageGroup.localeCompare(b.ageGroup);
        if (g !== 0) return g;
        return a.sex.localeCompare(b.sex);
      });
      setThresholds(sorted);
    } catch (err) {
      setError(toError(err, 'Falha ao carregar thresholds'));
    } finally {
      setIsLoading(false);
    }
  }, [labId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateThresholdInput): Promise<CriticosThresholdRecord> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        const res = await callCreate({ labId, ...input });
        await refresh();
        return res.data;
      } catch (err) {
        throw toError(err, 'Falha ao criar threshold');
      }
    },
    [labId, refresh],
  );

  const update = useCallback(
    async (input: UpdateThresholdInput): Promise<CriticosThresholdRecord> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        const res = await callUpdate({ labId, ...input });
        await refresh();
        return res.data;
      } catch (err) {
        throw toError(err, 'Falha ao atualizar threshold');
      }
    },
    [labId, refresh],
  );

  return { thresholds, isLoading, error, refresh, create, update };
}
