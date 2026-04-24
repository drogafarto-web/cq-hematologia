import { useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  softDeleteLeitura as softDeleteSvc,
  restoreLeitura as restoreSvc,
  subscribeLeituras,
  type SubscribeLeiturasOptions,
} from '../services/ctFirebaseService';
import type { LeituraTemperatura } from '../types/ControlTemperatura';

export interface UseLeiturasResult {
  leituras: LeituraTemperatura[];
  isLoading: boolean;
  error: Error | null;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

/**
 * Leituras ordenadas por dataHora desc. Criação passa por `useSaveLeitura`
 * que orquestra RN-01 (NC automática) + RN-02 (assinatura manual).
 */
export function useLeituras(options: SubscribeLeiturasOptions = {}): UseLeiturasResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, equipamentoId, inicio, fim } = options;

  const [leituras, setLeituras] = useState<LeituraTemperatura[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLeituras([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsubscribe = subscribeLeituras(
      labId,
      { includeDeleted, equipamentoId, inicio, fim },
      (list) => {
        setLeituras(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [labId, includeDeleted, equipamentoId, inicio, fim]);

  const softDelete = async (id: string): Promise<void> => {
    if (!labId) throw new Error('Sem lab ativo.');
    return softDeleteSvc(labId, id);
  };
  const restore = async (id: string): Promise<void> => {
    if (!labId) throw new Error('Sem lab ativo.');
    return restoreSvc(labId, id);
  };

  return { leituras, isLoading, error, softDelete, restore };
}
