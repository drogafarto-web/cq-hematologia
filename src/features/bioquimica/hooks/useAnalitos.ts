/**
 * bioquimica/hooks/useAnalitos.ts
 *
 * Hook real-time para listar analitos do lab ativo. Wraps o
 * `watchAnalitos` do service e cuida do lifecycle (cleanup automático).
 *
 * Padrão: usa `useActiveLabId()` (selector atômico) — NUNCA destruture o
 * store inteiro porque dispara re-render em qualquer mudança de auth.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchAnalitos } from '../services/analitoService';
import type { Analito } from '../types';

export interface UseAnalitosState {
  analitos: Analito[];
  loading: boolean;
  error: Error | null;
}

export function useAnalitos(): UseAnalitosState {
  const labId = useActiveLabId();
  const [state, setState] = useState<UseAnalitosState>({
    analitos: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!labId) {
      setState({ analitos: [], loading: false, error: new Error('No active lab') });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const unsubscribe = watchAnalitos(
      labId,
      (analitos) => setState({ analitos, loading: false, error: null }),
      (err) => setState((s) => ({ ...s, loading: false, error: err })),
    );

    return () => unsubscribe();
  }, [labId]);

  // Stabilize identity para consumers usando React.memo.
  return useMemo(
    () => ({
      analitos: state.analitos,
      loading: state.loading,
      error: state.error,
    }),
    [state.analitos, state.loading, state.error],
  );
}

/**
 * Selector helper: apenas analitos ativos. Útil em telas de runs onde
 * inativos não devem aparecer.
 */
export function useAnalitosAtivos(): UseAnalitosState {
  const { analitos, loading, error } = useAnalitos();
  const ativos = useMemo(() => analitos.filter((a) => a.ativo), [analitos]);
  return { analitos: ativos, loading, error };
}
