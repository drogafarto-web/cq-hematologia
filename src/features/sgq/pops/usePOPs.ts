import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { POP, POPFilters, POPInput } from '../types/POP';
import { subscribePOPs, createPOPClient, updatePOP, softDeletePOP } from './popsService';

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

  const criar = useCallback(
    async (input: POPInput) => {
      if (!labId) throw new Error('Lab não selecionado');
      return createPOPClient(labId, input);
    },
    [labId],
  );

  const atualizar = useCallback(
    async (popId: string, updates: Partial<Omit<POP, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>>) => {
      if (!labId) throw new Error('Lab não selecionado');
      return updatePOP(labId, popId, updates);
    },
    [labId],
  );

  const deletar = useCallback(
    async (popId: string) => {
      if (!labId) throw new Error('Lab não selecionado');
      return softDeletePOP(labId, popId);
    },
    [labId],
  );

  return { pops, loading, error, criar, atualizar, deletar };
}
