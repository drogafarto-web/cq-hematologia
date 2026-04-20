import { useState, useEffect } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToUroLots } from '../services/uroanaliseFirebaseService';
import type { UroanaliseLot } from '../types/Uroanalise';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useUroLots — assina em tempo real os lotes de CIQ-Uroanálise do lab ativo.
 *
 * Retorna lotes ordenados por createdAt desc (mais recentes primeiro).
 * Emite isLoading=true enquanto aguarda o primeiro snapshot do Firestore.
 *
 * Uso:
 *   const { lots, isLoading, error } = useUroLots();
 */
export function useUroLots() {
  const labId = useActiveLabId();

  const [lots,      setLots]      = useState<UroanaliseLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const unsub = subscribeToUroLots(
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
