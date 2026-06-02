import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase.config';
import { UroAberturaLote } from '@/features/uroanalise/types/Uroanalise';

interface UseUroAberturaAtivaResult {
  abertura: UroAberturaLote | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribes to the active (ativa === true) abertura for a given lot.
 * There should be at most one active abertura per lot at any time
 * (enforced transactionally by uroAberturaService.createAbertura).
 */
export function useUroAberturaAtiva(
  labId: string | undefined,
  lotId: string | undefined,
): UseUroAberturaAtivaResult {
  const [abertura, setAbertura] = useState<UroAberturaLote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !lotId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const aberturasRef = collection(db, 'labs', labId, 'ciq-uroanalise', lotId, 'aberturas');

    const q = query(
      aberturasRef,
      where('ativa', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    let unsub: Unsubscribe | null = null;

    try {
      unsub = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setAbertura(null);
          } else {
            const doc = snapshot.docs[0];
            setAbertura({ id: doc.id, ...doc.data() } as UroAberturaLote);
          }
          setLoading(false);
        },
        (err) => {
          console.error('[useUroAberturaAtiva] subscription error:', err);
          setError(new Error(err.message));
          setLoading(false);
        },
      );
    } catch (err) {
      console.error('[useUroAberturaAtiva] setup error:', err);
      setError(new Error((err as Error).message));
      setLoading(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [labId, lotId]);

  return { abertura, loading, error };
}
