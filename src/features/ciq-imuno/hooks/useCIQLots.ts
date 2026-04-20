import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCIQLots } from '../services/ciqFirebaseService';
import type { CIQImunoLot } from '../types/CIQImuno';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQLots — assina em tempo real os lotes de CIQ-Imuno do lab ativo.
 *
 * Retorna lotes ordenados por createdAt desc (mais recentes primeiro).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot do Firestore.
 *
 * Uso:
 *   const { lots, isLoading, error } = useCIQLots();
 */
export function useCIQLots() {
  const labId = useActiveLabId();

  const [lots, setLots] = useState<CIQImunoLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard + subscription pattern: ao trocar labId, limpa estado anterior
  // antes da nova subscription chegar. Rule too-strict aqui — sem o clear
  // explícito, o consumidor vê dados stale do lab anterior por ~1 frame.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setLots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToCIQLots(
      labId,
      (incoming) => {
        setLots(incoming);
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
  }, [labId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { lots, isLoading, error } as const;
}
