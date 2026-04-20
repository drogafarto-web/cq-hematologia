import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToUroRuns } from '../services/uroanaliseFirebaseService';
import type { UroanaliseRun } from '../types/Uroanalise';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useUroRuns — assina em tempo real as corridas de um lote CIQ-Uroanálise.
 *
 * Retorna corridas ordenadas por dataRealizacao asc (cronológico).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot.
 *
 * @param lotId  ID do lote a observar. Passar null desativa o listener.
 *
 * Uso:
 *   const { runs, isLoading, error } = useUroRuns(activeLotId);
 */
export function useUroRuns(lotId: string | null) {
  const labId = useActiveLabId();

  const [runs, setRuns] = useState<UroanaliseRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !lotId) {
      setRuns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToUroRuns(
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
