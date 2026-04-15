import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCIQRuns } from '../services/ciqFirebaseService';
import type { CIQImunoRun } from '../types/CIQImuno';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQRuns — assina em tempo real as corridas de um lote CIQ-Imuno.
 *
 * Retorna corridas ordenadas por dataRealizacao asc (cronológico).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot.
 *
 * @param lotId  ID do lote a observar. Passar null desativa o listener.
 *
 * Uso:
 *   const { runs, isLoading, error } = useCIQRuns(activeLotId);
 */
export function useCIQRuns(lotId: string | null) {
  const labId = useActiveLabId();

  const [runs,      setRuns]      = useState<CIQImunoRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !lotId) {
      setRuns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToCIQRuns(
      labId,
      lotId,
      (incoming) => {
        setRuns(incoming);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, lotId]);

  return { runs, isLoading, error } as const;
}
