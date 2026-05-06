/**
 * useCAPAs.ts
 *
 * Hook reativo para CAPA tracking com deadline computation e sorting.
 * Inscreve-se a watchCAPAs em mount, limpa unsubscribe em unmount.
 * Retorna lista com status de deadline (on-track/at-risk/overdue).
 *
 * Performance: <50ms para 12 CAPAs (típico).
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchCAPAs } from '../services/capaService';
import type { CAPA, CAPAWithDeadlineStatus, DeadlineStatus } from '../types';

/**
 * Calcula dias até deadline e status visual.
 * Thresholds:
 * - >7 dias: on-track (emerald)
 * - 1-7 dias: at-risk (amber)
 * - <0: overdue (red)
 */
function computeDeadlineStatus(capa: CAPA): DeadlineStatus {
  const now = new Date();
  const deadlineMs = capa.deadline?.toMillis?.() ?? 0;
  const nowMs = now.getTime();
  const daysRemaining = Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24));

  if (daysRemaining > 7) {
    return {
      daysRemaining,
      status: 'on-track',
      color: 'emerald',
    };
  }
  if (daysRemaining >= 0) {
    return {
      daysRemaining,
      status: 'at-risk',
      color: 'amber',
    };
  }
  return {
    daysRemaining,
    status: 'overdue',
    color: 'red',
  };
}

interface UseCAPAsResult {
  capas: CAPAWithDeadlineStatus[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook para listar todos os CAPAs do lab ativo.
 * Auto-atualiza com real-time subscription.
 */
export function useCAPAs(): UseCAPAsResult {
  const labId = useActiveLabId();
  const [capas, setCapas] = useState<CAPAWithDeadlineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setCapas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = watchCAPAs(
      labId,
      (rawCapas) => {
        // Adiciona deadline status computed a cada CAPA
        const withStatus: CAPAWithDeadlineStatus[] = rawCapas.map((capa) => ({
          ...capa,
          deadlineStatus: computeDeadlineStatus(capa),
        }));

        // Ordena por deadline (próximas primeiro)
        withStatus.sort((a, b) => {
          const aTime = a.deadline?.toMillis?.() ?? 0;
          const bTime = b.deadline?.toMillis?.() ?? 0;
          return aTime - bTime;
        });

        setCapas(withStatus);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [labId]);

  return { capas, loading, error };
}
