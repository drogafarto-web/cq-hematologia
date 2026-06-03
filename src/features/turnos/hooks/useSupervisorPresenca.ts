import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { subscribePresenca } from '../services/turnosService';
import { callSupervisorCheckin, callSupervisorCheckout } from '../services/turnosCallables';
import type { Turno, TurnoPresenca } from '../types/Turno';

export interface UseSupervisorPresencaResult {
  presenca: TurnoPresenca | null;
  isLoading: boolean;
  error: Error | null;
  /** True when caller is the designated supervisor of the turno. */
  isDesignatedSupervisor: boolean;
  /** True when caller is the supervisor currently checked in (active). */
  isCheckedIn: boolean;
  /** True when checkout/checkin is in flight. */
  isMutating: boolean;
  checkIn: () => Promise<void>;
  checkOut: (observacoes?: string | null) => Promise<void>;
}

/**
 * Hook governing supervisor presence (check-in / check-out) for a single turno.
 *
 * RDC 978/2025 Art. 122 — supervisor confirms physical presence per shift.
 * The hook:
 *   - subscribes to /labs/{labId}/turnos/{turnoId}/presenca/current
 *   - exposes `checkIn` / `checkOut` mutations that call the corresponding callables
 *   - derives ergonomic flags for UI gating
 */
export function useSupervisorPresenca(
  turno: Turno | null | undefined,
): UseSupervisorPresencaResult {
  const labId = useActiveLabId();
  const user = useUser();

  const [presenca, setPresenca] = useState<TurnoPresenca | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(turno && labId));
  const [error, setError] = useState<Error | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (!labId || !turno) {
      setPresenca(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribePresenca(
      labId,
      turno.id,
      (next) => {
        setPresenca(next);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, turno?.id]);

  const callerUid = user?.uid ?? null;

  const isDesignatedSupervisor = Boolean(callerUid && turno && turno.supervisorId === callerUid);

  const isCheckedIn = Boolean(
    presenca?.status === 'active' && callerUid && presenca?.supervisorAtivo?.uid === callerUid,
  );

  const checkIn = useCallback(async () => {
    if (!labId) throw new Error('Sem lab ativo.');
    if (!turno) throw new Error('Turno não selecionado.');
    if (!callerUid) throw new Error('Usuário não autenticado.');
    setIsMutating(true);
    try {
      await callSupervisorCheckin({
        labId,
        turnoId: turno.id,
        supervisorUid: callerUid,
      });
    } finally {
      setIsMutating(false);
    }
  }, [labId, turno?.id, callerUid]);

  const checkOut = useCallback(
    async (observacoes?: string | null) => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!turno) throw new Error('Turno não selecionado.');
      setIsMutating(true);
      try {
        await callSupervisorCheckout({
          labId,
          turnoId: turno.id,
          observacoes: observacoes ?? null,
        });
      } finally {
        setIsMutating(false);
      }
    },
    [labId, turno?.id],
  );

  return {
    presenca,
    isLoading,
    error,
    isDesignatedSupervisor,
    isCheckedIn,
    isMutating,
    checkIn,
    checkOut,
  };
}
