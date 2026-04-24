import { useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeLeiturasPrevistas,
  updateLeituraPrevistaStatus,
  type SubscribeLeiturasPrevistasOptions,
} from '../services/ctFirebaseService';
import type { LeituraPrevista, StatusLeituraPrevista } from '../types/ControlTemperatura';

export interface UseLeiturasPrevistasResult {
  previstas: LeituraPrevista[];
  isLoading: boolean;
  error: Error | null;
  marcarStatus: (id: string, status: StatusLeituraPrevista, leituraId?: string) => Promise<void>;
}

export function useLeiturasPrevistas(
  options: SubscribeLeiturasPrevistasOptions = {},
): UseLeiturasPrevistasResult {
  const labId = useActiveLabId();
  const { equipamentoId, status, inicio, fim } = options;

  const [previstas, setPrevistas] = useState<LeituraPrevista[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setPrevistas([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeLeiturasPrevistas(
      labId,
      { equipamentoId, status, inicio, fim },
      (list) => {
        setPrevistas(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, equipamentoId, status, inicio, fim]);

  const marcarStatus = async (
    id: string,
    next: StatusLeituraPrevista,
    leituraId?: string,
  ): Promise<void> => {
    if (!labId) throw new Error('Sem lab ativo.');
    return updateLeituraPrevistaStatus(labId, id, next, leituraId);
  };

  return { previstas, isLoading, error, marcarStatus };
}
