import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToCoagLots } from '../services/coagulacaoFirebaseService';
import type { CoagulacaoLot } from '../types/Coagulacao';
import type { CoagNivel } from '../types/_shared_refs';

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
export function useCoagLots(nivel?: CoagNivel | null) {
  const labId = useActiveLabId();

  const [lots, setLots] = useState<CoagulacaoLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard + subscription pattern — ver useCIQLots para justificativa.
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

    const unsub = subscribeToCoagLots(
      labId,
      (incoming) => {
        // Se nivel está definido, ignora lotes de outro nível
        if (nivel) {
          const filtered = incoming.filter((l) => l.nivel === nivel);
          setLots(filtered);
        } else {
          setLots(incoming);
        }
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
  }, [labId, nivel]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { lots, isLoading, error } as const;
}
