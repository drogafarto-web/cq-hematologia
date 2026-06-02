import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot } from '../../../shared/services/firebase';
import { firestoreErrorMessage } from '../../../shared/services/firebase';
import type { UroAberturaLote } from '../types/Uroanalise';

export interface UseUroAberturasResult {
  aberturas: UroAberturaLote[];
  isLoading: boolean;
  error: string | null;
}

export function useUroAberturas(
  labId: string | null | undefined,
  lotId: string | null | undefined,
): UseUroAberturasResult {
  const [aberturas, setAberturas] = useState<UroAberturaLote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId || !lotId) {
      setAberturas([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;

    const q = query(
      collection(db, 'labs', labId, 'ciq-uroanalise', lotId, 'aberturas'),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UroAberturaLote, 'id'>),
        }));
        setAberturas(items);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(firestoreErrorMessage(err));
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, lotId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { aberturas, isLoading, error };
}
