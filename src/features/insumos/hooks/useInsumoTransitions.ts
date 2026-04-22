/**
 * useInsumoTransitions — log de trocas de insumo ativo em um módulo (ou em
 * todos, se `module` for `null`). Ordenado do mais recente para o mais antigo.
 *
 * Usado em UI de auditoria (FR-10 v2 / aba Rastreabilidade) e em relatórios
 * cross-lote.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToTransitions } from '../services/insumoTransitionService';
import type { InsumoTransition } from '../types/InsumoTransition';
import type { InsumoModulo } from '../types/Insumo';

interface UseInsumoTransitionsResult {
  transitions: InsumoTransition[];
  isLoading: boolean;
  error: string | null;
}

export function useInsumoTransitions(params: {
  module?: InsumoModulo | null;
  maxResults?: number;
}): UseInsumoTransitionsResult {
  const labId = useActiveLabId();
  const [transitions, setTransitions] = useState<InsumoTransition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializa deps — evita resubscribe quando caller passa objeto novo por render.
  const paramsKey = useMemo(
    () => JSON.stringify({ module: params.module ?? null, maxResults: params.maxResults ?? null }),
    [params.module, params.maxResults],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setTransitions([]);
      setIsLoading(false);
      return;
    }

    const parsed = JSON.parse(paramsKey) as {
      module: InsumoModulo | null;
      maxResults: number | null;
    };

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const unsub = subscribeToTransitions(
      labId,
      {
        ...(parsed.module && { module: parsed.module }),
        ...(parsed.maxResults && { maxResults: parsed.maxResults }),
      },
      (incoming) => {
        setTransitions(incoming);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, paramsKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { transitions, isLoading, error };
}
