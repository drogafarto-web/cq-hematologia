/**
 * useQualificacoes.ts
 *
 * Real-time subscription to operator qualifications (certifications).
 * Filters by `uid == operadorId && deletadoEm == null`.
 *
 * Returns list + derived expiry status + mutation helpers.
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeQualificacoes } from '../services/qualificacoesService';
import type { Qualificacao } from '../types';

interface UseQualificacoesOptions {
  operadorId?: string; // If provided, filters to this operator only
}

export function useQualificacoes({ operadorId }: UseQualificacoesOptions = {}) {
  const labId = useActiveLabId();
  const [qualificacoes, setQualificacoes] = useState<Qualificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setQualificacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeQualificacoes(
      labId,
      (data) => {
        setQualificacoes(data);
        setLoading(false);
      },
      operadorId,
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, operadorId]);

  return { qualificacoes, loading, error };
}
