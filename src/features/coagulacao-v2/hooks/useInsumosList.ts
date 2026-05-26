import { useEffect, useState } from 'react';
import { subscribeToInsumos } from '../../insumos/services/insumosFirebaseService';
import type { Insumo } from '../../insumos/types/Insumo';

interface UseInsumosListResult {
  insumos: Insumo[];
  loading: boolean;
  error: string | null;
}

export function useInsumosList(labId: string): UseInsumosListResult {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToInsumos(
      labId,
      (data) => {
        setInsumos(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { modulo: 'coagulacao', status: 'ativo' },
    );

    return () => unsub();
  }, [labId]);

  return { insumos, loading, error };
}
