import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createTrilha,
  restoreTrilha,
  softDeleteTrilha,
  subscribeTrilhas,
  updateTrilha,
  type SubscribeTrilhasOptions,
} from '../services/ecFirebaseService';
import type {
  TrilhaAprendizado,
  TrilhaAprendizadoInput,
} from '../types/EducacaoContinuada';

export interface UseTrilhasResult {
  trilhas: TrilhaAprendizado[];
  isLoading: boolean;
  error: Error | null;
  create: (input: TrilhaAprendizadoInput) => Promise<string>;
  update: (id: string, patch: Partial<TrilhaAprendizadoInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

export function useTrilhas(options: SubscribeTrilhasOptions = {}): UseTrilhasResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivas = false, cargo } = options;

  const [trilhas, setTrilhas] = useState<TrilhaAprendizado[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTrilhas([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsub = subscribeTrilhas(
      labId,
      { includeDeleted, somenteAtivas, cargo },
      (list) => {
        setTrilhas(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [labId, includeDeleted, somenteAtivas, cargo]);

  const create = useCallback(
    async (input: TrilhaAprendizadoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createTrilha(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TrilhaAprendizadoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateTrilha(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteTrilha(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreTrilha(labId, id);
    },
    [labId],
  );

  return { trilhas, isLoading, error, create, update, softDelete, restore };
}
