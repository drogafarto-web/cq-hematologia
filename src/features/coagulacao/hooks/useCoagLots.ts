import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCoagLots } from '../services/coagulacaoFirebaseService';
import type { CoagulacaoLot } from '../types/Coagulacao';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCoagLots — assina em tempo real os lotes de CIQ-Coagulação do lab ativo.
 *
 * Retorna lotes ordenados por createdAt desc (mais recentes primeiro).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot do Firestore.
 *
 * Uso:
 *   const { lots, isLoading, error } = useCoagLots();
 */
export function useCoagLots() {
  const labId = useActiveLabId();

  const [lots, setLots] = useState<CoagulacaoLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToCoagLots(
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

  return { lots, isLoading, error } as const;
}
