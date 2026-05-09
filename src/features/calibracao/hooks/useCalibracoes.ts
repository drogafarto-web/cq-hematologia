/**
 * useCalibracoes.ts
 *
 * React hook for real-time calibration list subscription.
 * Auto-unsubscribes on unmount (cleanup).
 *
 * Returns: { calibracoes, loading, error }
 * Sorted by nextDueDate ascending (soonest due first).
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCalibracoes } from '../services/calibracaoService';
import type { CalibracaoRecord } from '../types/index';

export interface UseCalibracoesResult {
  calibracoes: CalibracaoRecord[];
  loading: boolean;
  error: Error | null;
}

export function useCalibracoes(): UseCalibracoesResult {
  const labId = useActiveLabId();
  const [calibracoes, setCalibracoes] = useState<CalibracaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Guard: no lab active
    if (!labId) {
      setLoading(false);
      setCalibracoes([]);
      return;
    }

    // Subscribe to calibration list
    const unsubscribe = subscribeToCalibracoes(
      labId,
      (records) => {
        setCalibracoes(records);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    // Cleanup on unmount or labId change
    return () => unsubscribe();
  }, [labId]);

  return { calibracoes, loading, error };
}
