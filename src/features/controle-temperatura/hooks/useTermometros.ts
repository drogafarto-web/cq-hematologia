import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  computarStatusCalibracao,
  createTermometro,
  softDeleteTermometro,
  subscribeTermometros,
  updateTermometro,
  type SubscribeTermometrosOptions,
} from '../services/ctFirebaseService';
import type {
  StatusCalibracao,
  Termometro,
  TermometroInput,
} from '../types/ControlTemperatura';

export interface TermometroComStatus extends Termometro {
  statusCalibracao: StatusCalibracao;
}

export interface UseTermometrosResult {
  termometros: TermometroComStatus[];
  /** statusCalibracao === 'vencendo' (RN-05 alerta âmbar). */
  proximosAVencer: TermometroComStatus[];
  /** statusCalibracao === 'vencido' (RN-05 bloqueia emissão FR-11). */
  vencidos: TermometroComStatus[];
  isLoading: boolean;
  error: Error | null;
  create: (input: TermometroInput) => Promise<string>;
  update: (id: string, patch: Partial<Omit<TermometroInput, 'calibracaoAtual'>>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useTermometros(
  options: SubscribeTermometrosOptions = {},
): UseTermometrosResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false } = options;

  const [termometrosRaw, setTermometrosRaw] = useState<Termometro[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTermometrosRaw([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeTermometros(
      labId,
      { includeDeleted, somenteAtivos },
      (list) => {
        setTermometrosRaw(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, somenteAtivos]);

  const termometros: TermometroComStatus[] = useMemo(
    () =>
      termometrosRaw.map((t) => ({
        ...t,
        statusCalibracao: computarStatusCalibracao(t.calibracaoAtual),
      })),
    [termometrosRaw],
  );

  const proximosAVencer = useMemo(
    () => termometros.filter((t) => t.ativo && t.statusCalibracao === 'vencendo'),
    [termometros],
  );

  const vencidos = useMemo(
    () => termometros.filter((t) => t.ativo && t.statusCalibracao === 'vencido'),
    [termometros],
  );

  const create = useCallback(
    async (input: TermometroInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return createTermometro(labId, input);
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<TermometroInput, 'calibracaoAtual'>>): Promise<void> => {
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
    vencidos,
    isLoading,
    error,
    create,
    update,
    softDelete,
  };
}
