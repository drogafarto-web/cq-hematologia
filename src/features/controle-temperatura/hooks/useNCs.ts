import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createNC,
  resolverNC as resolverSvc,
  softDeleteNC,
  subscribeNCs,
  updateNC,
  type SubscribeNCsOptions,
} from '../services/ctFirebaseService';
import type { NCInput, NaoConformidadeTemp } from '../types/ControlTemperatura';

export interface UseNCsResult {
  ncs: NaoConformidadeTemp[];
  isLoading: boolean;
  error: Error | null;
  create: (input: NCInput) => Promise<string>;
  update: (id: string, patch: Partial<NCInput>) => Promise<void>;
  resolver: (id: string, acaoCorretiva: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useNCs(options: SubscribeNCsOptions = {}): UseNCsResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, equipamentoId, status } = options;

  const [ncs, setNcs] = useState<NaoConformidadeTemp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setNcs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeNCs(
      labId,
      { includeDeleted, equipamentoId, status },
      (list) => {
        setNcs(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, equipamentoId, status]);

  const create = useCallback(
    async (input: NCInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createNC(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<NCInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateNC(labId, id, patch);
    },
    [labId],
  );

  const resolver = useCallback(
    async (id: string, acaoCorretiva: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return resolverSvc(labId, id, acaoCorretiva);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteNC(labId, id);
    },
    [labId],
  );

  return { ncs, isLoading, error, create, update, resolver, softDelete };
}
