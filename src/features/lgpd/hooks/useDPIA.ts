/**
 * useDPIA hook — Real-time subscription to lab's DPIA document
 */

import { useEffect, useState } from 'react';
import { subscribeDPIA } from '../services/lgpdService';
import type { DPIA } from '../types';

interface UseDPIAResult {
  dpia: DPIA | null;
  loading: boolean;
  error: Error | null;
}

export function useDPIA(labId: string): UseDPIAResult {
  const [dpia, setDpia] = useState<DPIA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeDPIA(
      labId,
      (data) => {
        setDpia(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId]);

  return { dpia, loading, error };
}
