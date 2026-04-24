import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createTreinamento,
  restoreTreinamento,
  softDeleteTreinamento,
  subscribeTreinamentos,
  updateTreinamento,
  type SubscribeTreinamentosOptions,
} from '../services/ecFirebaseService';
import type {
  Treinamento,
  TreinamentoInput,
} from '../types/EducacaoContinuada';

export interface UseTreinamentosResult {
  treinamentos: Treinamento[];
  isLoading: boolean;
  error: Error | null;
  create: (input: TreinamentoInput) => Promise<string>;
  update: (id: string, patch: Partial<TreinamentoInput>) => Promise<void>;
  /** Deleção lógica (RN-06). */
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

/**
 * Hook para a coleção de treinamentos (FR-027) do tenant ativo. Segue o
 * mesmo contrato e comportamento de `useColaboradores` — ver docstring lá.
 */
export function useTreinamentos(
  options: SubscribeTreinamentosOptions = {},
): UseTreinamentosResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false } = options;

  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTreinamentos([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeTreinamentos(
      labId,
      { includeDeleted, somenteAtivos },
      (list) => {
        setTreinamentos(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, includeDeleted, somenteAtivos]);

  const create = useCallback(
    async (input: TreinamentoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createTreinamento(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TreinamentoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateTreinamento(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteTreinamento(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreTreinamento(labId, id);
    },
    [labId],
  );

  return { treinamentos, isLoading, error, create, update, softDelete, restore };
}
