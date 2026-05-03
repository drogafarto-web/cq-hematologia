import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { POP, POPFilters } from '../types/POP';
import { subscribePOPs } from './popsService';

export function usePOPs(filters: POPFilters = {}) {
  const labId = useActiveLabId();
  const [pops, setPOPs] = useState<POP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePOPs(
      labId,
      filters,
      (data) => {
        setPOPs(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, JSON.stringify(filters)]);

  return { pops, loading, error };
}
