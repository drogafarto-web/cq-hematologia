/**
 * personnel/hooks/useDesignacoes.ts
 *
 * Subscribe à lista de designações em tempo real.
 * Deriva mapa de designações ativas por cargo.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { watchDesignacoes, getActiveDesignacoesByRole } from '../services/designacaoService';
import type { Designacao, LabId } from '../types';

interface UseDesignacaoState {
  designacoes: Designacao[];
  currentByRole: Map<string, Designacao>;
  loading: boolean;
  error: Error | null;
}

export function useDesignacoes(): UseDesignacaoState {
  const [state, setState] = useState<UseDesignacaoState>({
    designacoes: [],
    currentByRole: new Map(),
    loading: true,
    error: null,
  });

  const labId = useActiveLabId() as LabId | null;

  useEffect(() => {
    if (!labId) {
      setState((s) => ({ ...s, loading: false, error: new Error('No active lab') }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const unsubscribe = watchDesignacoes(
      labId,
      async (designacoes) => {
        try {
          const currentByRole = await getActiveDesignacoesByRole(labId);
          setState({ designacoes, currentByRole, loading: false, error: null });
        } catch (err) {
          setState((s) => ({ ...s, error: err as Error }));
        }
      },
      (err) => {
        setState((s) => ({ ...s, error: err, loading: false }));
      },
    );

    return () => {
      unsubscribe();
    };
  }, [labId]);

  return state;
}

/**
 * Memoized lookup: given a cargoId, return current designacao or undefined.
 */
export function useCurrentDesignacao(cargoId: string): Designacao | undefined {
  const { currentByRole } = useDesignacoes();
  return useMemo(() => currentByRole.get(cargoId), [currentByRole, cargoId]);
}
