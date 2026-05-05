/**
 * useCEQ — React hook for CEQ state and operations
 *
 * Manages:
 * - CEQParticipacao list + selection
 * - CEQAmostra tracking per participacao
 * - CEQResultado entry + validation
 * - Real-time Z-score display
 * - NC auto-creation feedback
 */

import { useState, useCallback, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase.config';
import { collection, query, where } from 'firebase/firestore';
import { useAuthStore, useActiveLab } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import type {
  CEQParticipacao,
  CEQAmostra,
  CEQResultado,
  CEQParticipacaoInput,
  CEQAmostraInput,
  CEQResultadoInput,
} from '../types/CEQ';
import {
  criarCEQParticipacao,
  receberCEQAmostra,
  lancarCEQResultado,
  listarCEQParticipacoes,
  listarCEQAmostras,
  listarCEQResultados,
  validarCEQResultado,
  obterCEQResultado,
} from '../services/ceqService';

interface CEQState {
  participacoes: CEQParticipacao[];
  amostras: CEQAmostra[];
  resultados: CEQResultado[];

  selectedParticipacao: CEQParticipacao | null;
  selectedAmostra: CEQAmostra | null;

  loading: boolean;
  error: string | null;
}

const initialState: CEQState = {
  participacoes: [],
  amostras: [],
  resultados: [],
  selectedParticipacao: null,
  selectedAmostra: null,
  loading: false,
  error: null,
};

export function useCEQ() {
  const [state, setState] = useState(initialState);
  const activeLab = useActiveLab();
  const uid = useAuthStore((s) => s.appProfile?.user?.uid ?? '');

  // ─── Load participacoes ──────────────────────────────────────────────────

  useEffect(() => {
    if (!activeLab) return;

    const q = query(
      collection(db, 'labs', activeLab.id, 'ceq-participacoes'),
      where('ativo', '==', true),
      where('deletadoEm', '==', null),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const participacoes = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          criadoEm: data.criadoEm?.toDate() || new Date(),
          dataInicio: data.dataInicio?.toDate() || new Date(),
          dataFim: data.dataFim?.toDate(),
          atualizadoEm: data.atualizadoEm?.toDate(),
          deletadoEm: data.deletadoEm?.toDate(),
        } as CEQParticipacao;
      });

      setState((s) => ({ ...s, participacoes }));
    });

    return unsubscribe;
  }, [activeLab]);

  // ─── Load amostras when participacao selected ─────────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedParticipacao) return;

    const q = query(
      collection(db, 'labs', activeLab.id, 'ceq-amostras'),
      where('ceqParticipacaoId', '==', state.selectedParticipacao.id),
      where('deletadoEm', '==', null),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const amostras = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          criadoEm: data.criadoEm?.toDate() || new Date(),
          dataRecepcao: data.dataRecepcao?.toDate() || new Date(),
          dataResultado: data.dataResultado?.toDate(),
          resultadoRecebidoEm: data.resultadoRecebidoEm?.toDate(),
          deletadoEm: data.deletadoEm?.toDate(),
        } as CEQAmostra;
      });

      setState((s) => ({ ...s, amostras }));
    });

    return unsubscribe;
  }, [activeLab, state.selectedParticipacao]);

  // ─── Load resultados when amostra selected ──────────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedAmostra) return;

    const q = query(
      collection(db, 'labs', activeLab.id, 'ceq-resultados'),
      where('ceqAmostraId', '==', state.selectedAmostra.id),
      where('deletadoEm', '==', null),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resultados = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          criadoEm: data.criadoEm?.toDate() || new Date(),
          atualizadoEm: data.atualizadoEm?.toDate(),
          validadoEm: data.validadoEm?.toDate(),
          ncAutomaticaCriadaEm: data.ncAutomaticaCriadaEm?.toDate(),
          deletadoEm: data.deletadoEm?.toDate(),
          investigacao: data.investigacao
            ? {
                ...data.investigacao,
                dataInicio: data.investigacao.dataInicio?.toDate() || new Date(),
                dataFim: data.investigacao.dataFim?.toDate(),
              }
            : undefined,
        } as CEQResultado;
      });

      setState((s) => ({ ...s, resultados }));
    });

    return unsubscribe;
  }, [activeLab, state.selectedAmostra]);

  // ─── Operations ───────────────────────────────────────────────────────────

  const criarParticipacao = useCallback(
    async (input: CEQParticipacaoInput) => {
      if (!activeLab) return;

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const participacao = await criarCEQParticipacao(activeLab.id, input, uid);
        toast.success(`Participação criada — ${participacao.provedorNome} · ${participacao.esquema}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao criar participação';
        setState((s) => ({ ...s, error: msg }));
        toast.error(msg);
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [activeLab, uid],
  );

  const receberAmostra = useCallback(
    async (input: CEQAmostraInput) => {
      if (!activeLab) return;

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const amostra = await receberCEQAmostra(activeLab.id, input, uid);
        toast.success(`Amostra recebida — Rodada ${amostra.rodada}/${amostra.ano}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao receber amostra';
        setState((s) => ({ ...s, error: msg }));
        toast.error(msg);
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [activeLab, uid],
  );

  const lancarResultado = useCallback(
    async (input: CEQResultadoInput) => {
      if (!activeLab) return;

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const resultado = await lancarCEQResultado(activeLab.id, input, uid);

        if (resultado.temNCGrave) {
          toast.warning(`NC Automática Criada — Z-Score ${resultado.zScore.toFixed(2)} ≥ 3 — Investigação necessária`);
        } else {
          toast.success(`Resultado lançado — ${resultado.analyteName} · Z ${resultado.zScore.toFixed(2)}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao lançar resultado';
        setState((s) => ({ ...s, error: msg }));
        toast.error(msg);
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [activeLab, uid],
  );

  const validar = useCallback(
    async (resultadoId: string) => {
      if (!activeLab) return;

      setState((s) => ({ ...s, loading: true }));

      try {
        await validarCEQResultado(activeLab.id, resultadoId, uid);
        toast.success('Resultado validado');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Erro ao validar';
        setState((s) => ({ ...s, error: msg }));
        toast.error(msg);
      } finally {
        setState((s) => ({ ...s, loading: false }));
      }
    },
    [activeLab, uid],
  );

  return {
    ...state,
    selectParticipacao: (p: CEQParticipacao | null) =>
      setState((s) => ({
        ...s,
        selectedParticipacao: p,
        selectedAmostra: null,
        resultados: [],
      })),
    selectAmostra: (a: CEQAmostra | null) =>
      setState((s) => ({ ...s, selectedAmostra: a, resultados: [] })),

    criarParticipacao,
    receberAmostra,
    lancarResultado,
    validar,
  };
}
