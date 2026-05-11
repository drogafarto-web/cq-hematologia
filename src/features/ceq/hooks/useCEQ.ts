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
import { FirebaseError } from 'firebase/app';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase.config';
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

function formatCeqSnapshotError(err: unknown): string {
  if (err instanceof FirebaseError && err.code === 'permission-denied') {
    return (
      'CEQ: permissão negada. Faça logout e login para atualizar o token; confira claim modules.ceq ' +
      'e associação ao laboratório.'
    );
  }
  return err instanceof Error ? err.message : 'Erro ao carregar dados CEQ';
}

async function primeAuthTokenForFirestore(): Promise<void> {
  try {
    await auth.currentUser?.getIdToken(true);
  } catch {
    /* ignore — snapshot still attempts with current session */
  }
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
  const [listenerEpoch, setListenerEpoch] = useState(0);
  const activeLab = useActiveLab();
  const uid = useAuthStore((s) => s.appProfile?.user?.uid ?? '');

  const retryCeqFirestoreListeners = useCallback(async () => {
    try {
      await auth.currentUser?.getIdToken(true);
      setState((s) => ({ ...s, error: null }));
      setListenerEpoch((e) => e + 1);
    } catch {
      toast.error('Não foi possível atualizar o token. Faça logout e login.');
    }
  }, []);

  /**
   * NOTA OPERACIONAL:
   * Se persistir 'permission-denied' após 'Recarregar permissões', o usuário precisa
   * de provisionamento de claims (modules.ceq) ou correção do documento 'members'
   * associado ao laboratório — isso é uma ação de backend/admin.
   */

  // ─── Load participacoes ──────────────────────────────────────────────────

  useEffect(() => {
    if (!activeLab) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', activeLab.id, 'ceq-participacoes'),
        where('ativo', '==', true),
        where('deletadoEm', '==', null),
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
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

          setState((s) => ({ ...s, participacoes, error: null }));
        },
        (err) => {
          const msg = formatCeqSnapshotError(err);
          setState((s) => ({ ...s, participacoes: [], error: msg }));
          toast.error(msg);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, listenerEpoch]);

  // ─── Load amostras when participacao selected ─────────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedParticipacao) return;

    const participacaoId = state.selectedParticipacao.id;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', activeLab.id, 'ceq-amostras'),
        where('ceqParticipacaoId', '==', participacaoId),
        where('deletadoEm', '==', null),
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
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

          setState((s) => ({ ...s, amostras, error: null }));
        },
        (err) => {
          const msg = formatCeqSnapshotError(err);
          setState((s) => ({ ...s, amostras: [], error: msg }));
          toast.error(msg);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, state.selectedParticipacao, listenerEpoch]);

  // ─── Load resultados when amostra selected ──────────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedAmostra) return;

    const amostraId = state.selectedAmostra.id;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', activeLab.id, 'ceq-resultados'),
        where('ceqAmostraId', '==', amostraId),
        where('deletadoEm', '==', null),
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
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

          setState((s) => ({ ...s, resultados, error: null }));
        },
        (err) => {
          const msg = formatCeqSnapshotError(err);
          setState((s) => ({ ...s, resultados: [], error: msg }));
          toast.error(msg);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, state.selectedAmostra, listenerEpoch]);

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
    retryCeqFirestoreListeners,
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
