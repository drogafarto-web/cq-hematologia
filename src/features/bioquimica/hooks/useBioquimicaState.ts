/**
 * bioquimica/hooks/useBioquimicaState.ts
 *
 * Hook agregador — orquestra os 3 listeners do módulo (config, analitos,
 * lotes) num único `useEffect` com cleanup unificado. Substitui a
 * necessidade de chamar 3 `useXxx()` separados em telas de visão geral.
 *
 * NÃO inclui runs por default — runs são por equipamento e podem explodir
 * volume; consumers que precisam de runs usam `useRuns(equipmentId)`
 * dedicado (Plan 09-02).
 *
 * Multi-tenant: depende de `useActiveLabId()`. Sem lab ativo → estado vazio
 * com erro descritivo, sem disparar listener.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeAnalitos,
  subscribeBioquimicaConfig,
  subscribeLotes,
} from '../services/bioquimicaService';
import type { Timestamp } from '../../../shared/services/firebase';
import type { Analito, ControlMaterial } from '../types';

export interface BioquimicaConfig {
  enabled?: boolean;
  seededAt?: Timestamp;
}

export interface UseBioquimicaState {
  config: BioquimicaConfig | null;
  analitos: Analito[];
  lotes: ControlMaterial[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: UseBioquimicaState = {
  config: null,
  analitos: [],
  lotes: [],
  isLoading: true,
  error: null,
};

export function useBioquimicaState(): UseBioquimicaState {
  const labId = useActiveLabId();
  const [state, setState] = useState<UseBioquimicaState>(initialState);

  useEffect(() => {
    if (!labId) {
      setState({
        ...initialState,
        isLoading: false,
        error: new Error('No active lab'),
      });
      return;
    }

    setState({ ...initialState, isLoading: true });

    // Track per-listener readiness — só sai do loading quando os 3 chegaram.
    let configReady = false;
    let analitosReady = false;
    let lotesReady = false;

    const maybeFinishLoading = () => {
      if (configReady && analitosReady && lotesReady) {
        setState((s) => ({ ...s, isLoading: false }));
      }
    };

    const unsubConfig = subscribeBioquimicaConfig(
      labId,
      (config) => {
        configReady = true;
        setState((s) => ({ ...s, config }));
        maybeFinishLoading();
      },
      (err) => setState((s) => ({ ...s, error: err, isLoading: false })),
    );

    const unsubAnalitos = subscribeAnalitos(
      labId,
      (analitos) => {
        analitosReady = true;
        setState((s) => ({ ...s, analitos }));
        maybeFinishLoading();
      },
      (err) => setState((s) => ({ ...s, error: err, isLoading: false })),
    );

    const unsubLotes = subscribeLotes(
      labId,
      (lotes) => {
        lotesReady = true;
        setState((s) => ({ ...s, lotes }));
        maybeFinishLoading();
      },
      (err) => setState((s) => ({ ...s, error: err, isLoading: false })),
    );

    return () => {
      unsubConfig();
      unsubAnalitos();
      unsubLotes();
    };
  }, [labId]);

  return useMemo(
    () => ({
      config: state.config,
      analitos: state.analitos,
      lotes: state.lotes,
      isLoading: state.isLoading,
      error: state.error,
    }),
    [state.config, state.analitos, state.lotes, state.isLoading, state.error],
  );
}
