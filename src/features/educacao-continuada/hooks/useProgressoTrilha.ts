import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import {
  createProgressoTrilha,
  softDeleteProgressoTrilha,
  subscribeProgressos,
  updateProgressoTrilha,
  type SubscribeProgressosOptions,
} from '../services/ecFirebaseService';
import type {
  ProgressoEtapa,
  ProgressoTrilha,
  ProgressoTrilhaInput,
  TrilhaAprendizado,
} from '../types/EducacaoContinuada';

import { useAvaliacaoCompetencia } from './useAvaliacaoCompetencia';
import { useExecucoes } from './useExecucoes';

export interface UseProgressoTrilhaResult {
  progressos: ProgressoTrilha[];
  isLoading: boolean;
  error: Error | null;
  /**
   * Inicia uma trilha para um colaborador (usado pela RN-08 e por seleção
   * manual). Cria estado inicial das etapas como `pendente`.
   */
  iniciar: (colaboradorId: string, trilha: TrilhaAprendizado) => Promise<string>;
  /** Pausa/retoma. */
  setStatus: (id: string, status: ProgressoTrilha['status']) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

/**
 * RN-08 helper exposto + RN-09 (etapa só vira "aprovado" quando há
 * AvaliacaoCompetencia aprovada para o (colaboradorId, templateId)).
 *
 * O recálculo de status acontece sempre que `avaliacoesCompetencia` ou
 * `execucoes` mudam — derivação client-side em tempo real (similar à Matriz).
 */
export function useProgressoTrilha(
  options: SubscribeProgressosOptions = {},
): UseProgressoTrilhaResult {
  const labId = useActiveLabId();
  const { includeDeleted = false, colaboradorId, trilhaId, status } = options;

  const [progressos, setProgressos] = useState<ProgressoTrilha[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  const execucoesHook = useExecucoes({});
  const competenciasHook = useAvaliacaoCompetencia({});

  useEffect(() => {
    if (!labId) {
      setProgressos([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const unsub = subscribeProgressos(
      labId,
      { includeDeleted, colaboradorId, trilhaId, status },
      (list) => {
        setProgressos(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [labId, includeDeleted, colaboradorId, trilhaId, status]);

  /**
   * Re-deriva status das etapas em memória (RN-09). Se uma etapa pendente já
   * tem AvaliacaoCompetencia aprovada para (colaboradorId, templateId via
   * execucao), promove para 'aprovado'.
   */
  const progressosComputados = useMemo(() => {
    const execToTreinamento = new Map<string, string>();
    for (const e of execucoesHook.execucoes) execToTreinamento.set(e.id, e.treinamentoId);

    const aprovadasPor = new Map<string, ProgressoEtapa>();
    for (const av of competenciasHook.avaliacoes) {
      if (av.resultado !== 'aprovado') continue;
      const trId = execToTreinamento.get(av.execucaoId);
      if (!trId) continue;
      const key = `${av.colaboradorId}|${trId}`;
      const atual = aprovadasPor.get(key);
      if (!atual || (atual.dataRealizacao?.toMillis() ?? 0) < av.dataAvaliacao.toMillis()) {
        aprovadasPor.set(key, {
          templateId: trId,
          execucaoId: av.execucaoId,
          status: 'aprovado',
          dataRealizacao: av.dataAvaliacao,
        });
      }
    }

    return progressos.map((p) => {
      let mudou = false;
      const novasEtapas = p.etapas.map((etapa) => {
        if (etapa.status === 'aprovado') return etapa;
        const aprovacao = aprovadasPor.get(`${p.colaboradorId}|${etapa.templateId}`);
        if (aprovacao) {
          mudou = true;
          return { ...etapa, ...aprovacao };
        }
        return etapa;
      });
      if (!mudou) return p;
      const aprovadas = novasEtapas.filter((e) => e.status === 'aprovado').length;
      const pct = novasEtapas.length === 0 ? 0 : Math.round((aprovadas / novasEtapas.length) * 100);
      return { ...p, etapas: novasEtapas, percentualConcluido: pct };
    });
  }, [progressos, execucoesHook.execucoes, competenciasHook.avaliacoes]);

  const iniciar = useCallback(
    async (colId: string, trilha: TrilhaAprendizado): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      const etapasIniciais: ProgressoEtapa[] = trilha.etapas.map((e) => ({
        templateId: e.templateId,
        status: 'pendente' as const,
      }));
      const input: ProgressoTrilhaInput = {
        colaboradorId: colId,
        trilhaId: trilha.id,
        dataInicio: Timestamp.now(),
        status: 'em_andamento',
        etapas: etapasIniciais,
        percentualConcluido: 0,
      };
      return createProgressoTrilha(labId, input);
    },
    [labId],
  );

  const setStatus = useCallback(
    async (id: string, st: ProgressoTrilha['status']): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      const patch: Partial<ProgressoTrilhaInput> = { status: st };
      if (st === 'concluida') patch.dataConclusao = Timestamp.now();
      return updateProgressoTrilha(labId, id, patch);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteProgressoTrilha(labId, id);
    },
    [labId],
  );

  return {
    progressos: progressosComputados,
    isLoading,
    error,
    iniciar,
    setStatus,
    softDelete,
  };
}
