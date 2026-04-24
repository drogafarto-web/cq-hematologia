import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createEquipamento,
  restoreEquipamento,
  softDeleteEquipamento,
  subscribeEquipamentos,
  updateEquipamento,
  type SubscribeEquipamentosOptions,
} from '../services/ctFirebaseService';
import type {
  EquipamentoInput,
  EquipamentoMonitorado,
} from '../types/ControlTemperatura';

export interface UseEquipamentosResult {
  equipamentos: EquipamentoMonitorado[];
  isLoading: boolean;
  error: Error | null;
  create: (input: EquipamentoInput) => Promise<string>;
  update: (id: string, patch: Partial<EquipamentoInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

export function useEquipamentos(
  options: SubscribeEquipamentosOptions = {},
): UseEquipamentosResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, status } = options;

  const [equipamentos, setEquipamentos] = useState<EquipamentoMonitorado[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setEquipamentos([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeEquipamentos(
      labId,
      { includeDeleted, status },
      (list) => {
        setEquipamentos(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, status]);

  const create = useCallback(
    async (input: EquipamentoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createEquipamento(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<EquipamentoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateEquipamento(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteEquipamento(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreEquipamento(labId, id);
    },
    [labId],
  );

  return { equipamentos, isLoading, error, create, update, softDelete, restore };
}
