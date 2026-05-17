/**
 * useQualificacoes — hook de qualificações IQ/OQ/PQ de um equipamento.
 * Realtime subscription via Firestore onSnapshot.
 */

import { useEffect, useState } from 'react';
import type { Qualificacao } from '../types/Qualificacao';
import { subscribeQualificacoes } from '../services/qualificacaoService';

interface UseQualificacoesResult {
  qualificacoes: Qualificacao[];
  isLoading: boolean;
  error: string | null;
}

export function useQualificacoes(
  labId: string | null,
  equipamentoId: string | null,
): UseQualificacoesResult {
  const [qualificacoes, setQualificacoes] = useState<Qualificacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !equipamentoId) {
      setQualificacoes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = subscribeQualificacoes(
      labId,
      equipamentoId,
      (quals) => {
        setQualificacoes(quals);
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, equipamentoId]);

  return { qualificacoes, isLoading, error };
}
