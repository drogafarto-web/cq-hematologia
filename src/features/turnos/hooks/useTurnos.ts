import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeTurnos,
  type SubscribeTurnosOptions,
} from '../services/turnosService';
import {
  callCreateTurno,
  callUpdateTurno,
  callSoftDeleteTurno,
  callBackfill90Days,
  type CallBackfill90DaysResult,
} from '../services/turnosCallables';
import type { Turno, TurnoInput, TurnoUpdateInput } from '../types/Turno';

export interface UseTurnosResult {
  turnos: Turno[];
  isLoading: boolean;
  error: Error | null;
  /** Create a turno in the active lab */
  create: (input: TurnoInput) => Promise<string>;
  /** Update observacoes or supervisorName */
  update: (id: string, patch: TurnoUpdateInput) => Promise<void>;
  /** Soft-delete a turno */
  softDelete: (id: string) => Promise<void>;
  /** Admin-only: backfill last 90 days */
  backfill90Days: (dryRun?: boolean) => Promise<CallBackfill90DaysResult>;
}

/**
 * Hook para consumo da coleção de turnos do tenant ativo.
 *
 * - Assina em tempo real via `onSnapshot` quando há lab ativo
 * - Retorna lista vazia e sem subscribe quando `labId` é null
 * - Todas as mutations lançam `Error` se chamadas sem lab ativo
 */
export function useTurnos(
  options: SubscribeTurnosOptions = {},
): UseTurnosResult {
  const labId = useActiveLabId();

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTurnos([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeTurnos(
      labId,
      options,
      (list) => {
        setTurnos(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, options.from, options.to, options.periodo, options.supervisorId]);

  const create = useCallback(
    async (input: TurnoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      const result = await callCreateTurno({
        labId,
        data: input.data,
        periodo: input.periodo,
        supervisorId: input.supervisorId,
        observacoes: input.observacoes,
      });
      return result.turnoId;
    },
    [labId],
  );

  const update = useCallback(
    async (id: string, patch: TurnoUpdateInput): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      await callUpdateTurno({
        labId,
        turnoId: id,
        observacoes: patch.observacoes,
        supervisorName: patch.supervisorName,
      });
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      await callSoftDeleteTurno({
        labId,
        turnoId: id,
      });
    },
    [labId],
  );

  const backfill90Days = useCallback(
    async (dryRun?: boolean): Promise<CallBackfill90DaysResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return callBackfill90Days({
        labId,
        dryRun,
      });
    },
    [labId],
  );

  return {
    turnos,
    isLoading,
    error,
    create,
    update,
    softDelete,
    backfill90Days,
  };
}
