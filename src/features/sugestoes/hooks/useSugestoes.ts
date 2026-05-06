import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../../../types';
import type { Sugestao } from '../services/sugestaoService';

interface UseSugestoesOptions {
  categoria?: string;
  status?: string;
  ordenarPor?: 'votos' | 'recencia';
}

export function useSugestoes(labId: LabId, options?: UseSugestoesOptions) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [
      where('labId', '==', labId),
      where('deletadoEm', '==', null),
    ];

    if (options?.categoria) {
      constraints.push(where('categoria', '==', options.categoria));
    }

    if (options?.status) {
      constraints.push(where('status', '==', options.status));
    }

    if (options?.ordenarPor === 'votos') {
      constraints.push(orderBy('votos', 'desc'), orderBy('criadoEm', 'desc'));
    } else {
      constraints.push(orderBy('criadoEm', 'desc'));
    }

    const q = query(collection(db, `labs/${labId}/sugestoes`), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Sugestao)
        );

        setSugestoes(data);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, options?.categoria, options?.status, options?.ordenarPor]);

  return { sugestoes, isLoading, error };
}
