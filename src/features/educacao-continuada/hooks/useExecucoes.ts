import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createExecucao,
  restoreExecucao,
  softDeleteExecucao,
  subscribeExecucoes,
  updateExecucao,
  type SubscribeExecucoesOptions,
} from '../services/ecFirebaseService';
import type { Execucao, ExecucaoInput } from '../types/EducacaoContinuada';

export interface UseExecucoesResult {
  execucoes: Execucao[];
  isLoading: boolean;
  error: Error | null;
  /** Cria execução planejada. Saves que transicionam para 'realizado' ou 'adiado' devem usar `useSaveExecucao`. */
  create: (input: ExecucaoInput) => Promise<string>;
  /** Atualiza campos simples. Para transições complexas de status usar `useSaveExecucao`. */
  update: (id: string, patch: Partial<ExecucaoInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

/**
 * Hook de leitura e CRUD simples sobre execuções. Transições que envolvem
 * participantes (RN-03) ou cascata com AlertaVencimento (RN-05) ficam em
 * `useSaveExecucao` — a separação evita que o caller escreva parcialmente
 * um estado inconsistente por mexer só no status direto daqui.
 */
export function useExecucoes(
  options: SubscribeExecucoesOptions = {},
): UseExecucoesResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, treinamentoId, status } = options;

  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setExecucoes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeExecucoes(
      labId,
      { includeDeleted, treinamentoId, status },
      (list) => {
        setExecucoes(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, includeDeleted, treinamentoId, status]);

  const create = useCallback(
    async (input: ExecucaoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createExecucao(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ExecucaoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateExecucao(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteExecucao(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreExecucao(labId, id);
    },
    [labId],
  );

  return { execucoes, isLoading, error, create, update, softDelete, restore };
}
