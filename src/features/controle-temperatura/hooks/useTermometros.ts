import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createTermometro,
  softDeleteTermometro,
  subscribeTermometros,
  updateTermometro,
  type SubscribeTermometrosOptions,
} from '../services/ctFirebaseService';
import type { Termometro, TermometroInput } from '../types/ControlTemperatura';

export interface UseTermometrosResult {
  termometros: Termometro[];
  /** Termômetros com proximaCalibracao ≤ 30 dias (RN-05). */
  proximosAVencer: Termometro[];
  isLoading: boolean;
  error: Error | null;
  create: (input: TermometroInput) => Promise<string>;
  update: (id: string, patch: Partial<TermometroInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

const DIAS_ALERTA_CALIBRACAO = 30;

export function useTermometros(
  options: SubscribeTermometrosOptions = {},
): UseTermometrosResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false } = options;

  const [termometros, setTermometros] = useState<Termometro[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTermometros([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeTermometros(
      labId,
      { includeDeleted, somenteAtivos },
      (list) => {
        setTermometros(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, somenteAtivos]);

  const proximosAVencer = useMemo(() => {
    const limite = Date.now() + DIAS_ALERTA_CALIBRACAO * 24 * 60 * 60 * 1000;
    return termometros.filter((t) => t.ativo && t.proximaCalibracao.toMillis() <= limite);
  }, [termometros]);

  const create = useCallback(
    async (input: TermometroInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createTermometro(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TermometroInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateTermometro(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteTermometro(labId, id);
    },
    [labId],
  );

  return {
    termometros,
    proximosAVencer,
    isLoading,
    error,
    create,
    update,
    softDelete,
  };
}
