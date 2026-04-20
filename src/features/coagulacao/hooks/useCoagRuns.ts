import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCoagRuns } from '../services/coagulacaoFirebaseService';
import type { CoagulacaoRun } from '../types/Coagulacao';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCoagRuns — assina em tempo real as corridas de um lote CIQ-Coagulação.
 *
 * Retorna corridas ordenadas por dataRealizacao asc (cronológico).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot.
 *
 * @param lotId  ID do lote a observar. Passar null desativa o listener.
 *
 * Uso:
 *   const { runs, isLoading, error } = useCoagRuns(activeLotId);
 */
export function useCoagRuns(lotId: string | null) {
  const labId = useActiveLabId();

  const [runs, setRuns] = useState<CoagulacaoRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard + subscription pattern — ver useCIQLots para justificativa.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId || !lotId) {
      setRuns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToCoagRuns(
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
  /* eslint-enable react-hooks/set-state-in-effect */

  return { runs, isLoading, error } as const;
}
