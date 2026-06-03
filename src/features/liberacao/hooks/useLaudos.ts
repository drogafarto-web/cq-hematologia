import { useEffect, useState, useCallback } from 'react';
import { Laudo } from '../types/laudo';
import { subscribeLaudos, LaudoFilters } from '../services/laudoService';
import { useActiveLabId } from '../../../store/useAuthStore';

/**
 * Hook para gerenciar laudos em tempo real
 * Cuida de lifecycle (subscribe/unsubscribe)
 */
export function useLaudos(filters?: LaudoFilters) {
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const currentLabId = useActiveLabId();

  // Reset on mount
  useEffect(() => {
    if (!currentLabId) {
      setLaudos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeLaudos(
      currentLabId,
      filters,
      (data) => {
        setLaudos(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [currentLabId, filters?.status, filters?.criticoFlag, filters?.medicoSolicitanteId]);

  return { laudos, loading, error };
}
