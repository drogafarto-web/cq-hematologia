import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Attempt } from '../types/Attempt';

interface UseAttemptsResult {
  attempts: Attempt[];
  isLoading: boolean;
  error: string | null;
}

export function useAttempts(
  labId: string,
  options?: { controlOperacionalId?: string },
): UseAttemptsResult {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const constraints: any[] = [orderBy('criadoEm', 'desc')];
    if (options?.controlOperacionalId) {
      constraints.unshift(where('controlOperacionalId', '==', options.controlOperacionalId));
    }
    constraints.push(limit(50));

    const q = query(collection(db, 'labs', labId, 'attempts'), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Attempt));
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [labId, options?.controlOperacionalId]);

  return { attempts, isLoading, error };
}
