import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeAlertasVencimento,
  updateAlertaVencimentoStatus,
  type SubscribeAlertasVencimentoOptions,
} from '../services/ecFirebaseService';
import type {
  AlertaVencimento,
  StatusAlertaVencimento,
} from '../types/EducacaoContinuada';

export interface UseAlertasVencimentoResult {
  alertas: AlertaVencimento[];
  /** Alertas que já entraram na janela `diasAntecedencia` a partir de hoje. */
  alertasIminentes: AlertaVencimento[];
  /** Alertas cuja `dataVencimento` já passou. */
  alertasVencidos: AlertaVencimento[];
  isLoading: boolean;
  error: Error | null;
  marcarNotificado: (id: string) => Promise<void>;
  resolver: (id: string) => Promise<void>;
  reabrir: (id: string) => Promise<void>;
}

/**
 * Hook de alertas de vencimento. Alertas são criados exclusivamente pelo
 * batch atomic de `commitExecucaoRealizada` (RN-05) — não há `create` aqui,
 * apenas transições de status.
 *
 * `alertasIminentes` e `alertasVencidos` são derivações do estado atual em
 * função do tempo local do cliente — recalculados por `useMemo` a cada tick
 * do snapshot. Se o laboratório operar em fuso distinto dos usuários, o corte
 * pode apresentar 1 dia de defasagem. Marca-se como ⚠️ no futuro.
 */
export function useAlertasVencimento(
  options: SubscribeAlertasVencimentoOptions = {},
): UseAlertasVencimentoResult {
  const labId = useActiveLabId();
  const { status, treinamentoId } = options;

  const [alertas, setAlertas] = useState<AlertaVencimento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setAlertas([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeAlertasVencimento(
      labId,
      { status, treinamentoId },
      (list) => {
        setAlertas(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, status, treinamentoId]);

  const alertasIminentes = useMemo<AlertaVencimento[]>(() => {
    const hoje = Date.now();
    return alertas.filter((a) => {
      if (a.status === 'resolvido') return false;
      const venc = a.dataVencimento.toMillis();
      const limite = venc - a.diasAntecedencia * 24 * 60 * 60 * 1000;
      return hoje >= limite && hoje < venc;
    });
  }, [alertas]);

  const alertasVencidos = useMemo<AlertaVencimento[]>(() => {
    const hoje = Date.now();
    return alertas.filter(
      (a) => a.status !== 'resolvido' && a.dataVencimento.toMillis() < hoje,
    );
  }, [alertas]);

  const setStatus = useCallback(
    async (id: string, next: StatusAlertaVencimento): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return updateAlertaVencimentoStatus(labId, id, next);
    },
    [labId],
  );

  const marcarNotificado = useCallback(
    (id: string) => setStatus(id, 'notificado'),
    [setStatus],
  );
  const resolver = useCallback(
    (id: string) => setStatus(id, 'resolvido'),
    [setStatus],
  );
  const reabrir = useCallback(
    (id: string) => setStatus(id, 'pendente'),
    [setStatus],
  );

  return {
    alertas,
    alertasIminentes,
    alertasVencidos,
    isLoading,
    error,
    marcarNotificado,
    resolver,
    reabrir,
  };
}
