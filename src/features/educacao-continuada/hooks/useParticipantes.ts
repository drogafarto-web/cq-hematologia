import { useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeParticipantes,
  type SubscribeParticipantesOptions,
} from '../services/ecFirebaseService';
import type { Participante } from '../types/EducacaoContinuada';

export interface UseParticipantesResult {
  participantes: Participante[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook de leitura sobre participantes — sem mutations porque a escrita de
 * participantes é SEMPRE orquestrada por `useSaveExecucao` (atomic com a
 * execução). Gravar participante isoladamente violaria RN-03 (a execução
 * realizada precisa existir junto dos participantes).
 */
export function useParticipantes(
  options: SubscribeParticipantesOptions = {},
): UseParticipantesResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, execucaoId, colaboradorId } = options;

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setParticipantes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeParticipantes(
      labId,
      { includeDeleted, execucaoId, colaboradorId },
      (list) => {
        setParticipantes(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, includeDeleted, execucaoId, colaboradorId]);

  return { participantes, isLoading, error };
}
