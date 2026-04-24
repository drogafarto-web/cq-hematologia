import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  createDispositivo,
  softDeleteDispositivo,
  subscribeDispositivos,
  updateDispositivo,
  type SubscribeDispositivosOptions,
} from '../services/ctFirebaseService';
import {
  gerarTokenDispositivo,
  type TokenDispositivo,
} from '../services/ctIoTService';
import type { DispositivoInput, DispositivoIoT } from '../types/ControlTemperatura';

export interface UseDispositivosIoTResult {
  dispositivos: DispositivoIoT[];
  isLoading: boolean;
  error: Error | null;
  /**
   * Cria dispositivo + retorna token plain-text (UMA vez) pra flashear no ESP32.
   * Operador precisa copiar imediatamente — token não é recuperável depois.
   */
  createComToken: (
    input: Omit<DispositivoInput, 'tokenAcesso'>,
  ) => Promise<{ id: string; token: TokenDispositivo }>;
  update: (id: string, patch: Partial<DispositivoInput>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useDispositivosIoT(
  options: SubscribeDispositivosOptions = {},
): UseDispositivosIoTResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, somenteAtivos = false, equipamentoId } = options;

  const [dispositivos, setDispositivos] = useState<DispositivoIoT[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setDispositivos([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeDispositivos(
      labId,
      { includeDeleted, somenteAtivos, equipamentoId },
      (list) => {
        setDispositivos(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, somenteAtivos, equipamentoId]);

  const createComToken = useCallback(
    async (
      input: Omit<DispositivoInput, 'tokenAcesso'>,
    ): Promise<{ id: string; token: TokenDispositivo }> => {
      if (!labId) throw new Error('Sem lab ativo.');
      const token = await gerarTokenDispositivo();
      const id = await createDispositivo(labId, {
        ...input,
        tokenAcesso: token.hash,
      });
      return { id, token };
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: Partial<DispositivoInput>): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateDispositivo(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteDispositivo(labId, id);
    },
    [labId],
  );

  return { dispositivos, isLoading, error, createComToken, update, softDelete };
}
