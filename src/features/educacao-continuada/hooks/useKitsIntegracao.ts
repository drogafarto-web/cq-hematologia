import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createKit,
  restoreKit,
  softDeleteKit,
  subscribeKits,
  updateKit,
  type SubscribeKitsOptions,
} from '../services/ecFirebaseService';
import type { KitIntegracao, KitIntegracaoInput } from '../types/EducacaoContinuada';

export interface UseKitsIntegracaoResult {
  kits: KitIntegracao[];
  isLoading: boolean;
  error: Error | null;
  create: (input: KitIntegracaoInput) => Promise<string>;
  update: (id: string, patch: Partial<KitIntegracaoInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

/**
 * Hook de kits de integração — sequências ordenadas de templates por cargo
 * (ex: "Kit Biomédico Júnior"). Fase 6.
 */
export function useKitsIntegracao(
  options: SubscribeKitsOptions = {},
): UseKitsIntegracaoResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false } = options;

  const [kits, setKits] = useState<KitIntegracao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setKits([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeKits(
      labId,
      { includeDeleted, somenteAtivos },
      (list) => {
        setKits(list);
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
    async (input: KitIntegracaoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createKit(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<KitIntegracaoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateKit(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteKit(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreKit(labId, id);
    },
    [labId],
  );

  return { kits, isLoading, error, create, update, softDelete, restore };
}
