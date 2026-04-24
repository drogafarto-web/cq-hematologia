import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createColaborador,
  restoreColaborador,
  softDeleteColaborador,
  subscribeColaboradores,
  updateColaborador,
  type SubscribeColaboradoresOptions,
} from '../services/ecFirebaseService';
import type {
  Colaborador,
  ColaboradorInput,
} from '../types/EducacaoContinuada';

export interface UseColaboradoresResult {
  colaboradores: Colaborador[];
  isLoading: boolean;
  error: Error | null;
  /** Cria um colaborador no lab ativo. Lança se não houver lab ativo. */
  create: (input: ColaboradorInput) => Promise<string>;
  /** Atualiza campos de negócio. Lança se não houver lab ativo. */
  update: (id: string, patch: Partial<ColaboradorInput>) => Promise<void>;
  /** Deleção lógica (RN-06). Lança se não houver lab ativo. */
  softDelete: (id: string) => Promise<void>;
  /** Reverte deleção lógica. Lança se não houver lab ativo. */
  restore: (id: string) => Promise<void>;
}

/**
 * Hook para consumo da coleção de colaboradores do tenant ativo.
 *
 * - Assina em tempo real via `onSnapshot` quando há lab ativo
 * - Retorna lista vazia e sem subscribe quando `labId` é null (usuário sem
 *   tenant ativo) — não quebra nem trava em loading infinito
 * - Todas as mutations lançam `Error` se chamadas sem lab ativo (defense in
 *   depth contra bugs de UI que renderizem formulários sem guard)
 */
export function useColaboradores(
  options: SubscribeColaboradoresOptions = {},
): UseColaboradoresResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false } = options;

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setColaboradores([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeColaboradores(
      labId,
      { includeDeleted, somenteAtivos },
      (list) => {
        setColaboradores(list);
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
    async (input: ColaboradorInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createColaborador(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ColaboradorInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateColaborador(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteColaborador(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreColaborador(labId, id);
    },
    [labId],
  );

  return { colaboradores, isLoading, error, create, update, softDelete, restore };
}
