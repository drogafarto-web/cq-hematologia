/**
 * useAvaliacoesFornecedor — onSnapshot em avaliações periódicas do fornecedor (ordenado por data desc).
 */

import { useEffect, useState } from 'react';
import {
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { useActiveLabId } from '../../../store/useAuthStore';
import type { AvaliacaoFornecedor } from '../types/AvaliacaoFornecedor';

export interface UseAvaliacoesFornecedorResult {
  avaliacoes: AvaliacaoFornecedor[];
  loading: boolean;
  error: Error | null;
}

export function useAvaliacoesFornecedor(fornecedorId: string | null): UseAvaliacoesFornecedorResult {
  const labId = useActiveLabId();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoFornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !fornecedorId) {
      setAvaliacoes([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirestore();
    const q = query(
      collection(db, 'labs', labId, 'fornecedores', fornecedorId, 'avaliacoes-periodicas'),
      orderBy('data', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
          } as AvaliacaoFornecedor;
        });
        setAvaliacoes(list);
        setLoading(false);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, fornecedorId]);

  return { avaliacoes, loading, error };
}
