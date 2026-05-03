import { useEffect, useState } from 'react';
import { useActiveLabId } from '@/store/useAuthStore';
import type { NaoConformidade, NCFilters } from '../types/NaoConformidade';
import { subscribeNCs } from './ncService';

export function useNCs(filters: NCFilters = {}) {
  const labId = useActiveLabId();
  const [ncs, setNCs] = useState<NaoConformidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeNCs(
      labId,
      filters,
      (data) => {
        setNCs(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, JSON.stringify(filters)]);

  return { ncs, loading, error };
}
