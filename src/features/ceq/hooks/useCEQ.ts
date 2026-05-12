/**
 * useCEQ — React hook for CEQ state and operations
 *
 * Manages:
 * - CEQParticipacao list + selection
 * - CEQAmostra tracking per participacao
 * - CEQResultado entry + validation
 * - Real-time Z-score display
 * - NC auto-creation feedback
 *
 * Transport vs RBAC: snapshot (Listen/WebChannel) failures are classified with a unary
 * getDocs probe — permission-denied on listener + unary ok suggests client-side blocking
 * or streaming issues, not necessarily missing modules.ceq.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FirebaseError } from 'firebase/app';
import { onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase.config';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
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
} from '../services/ceqService';
import {
  classifyFirestoreListenerError,
  formatCeqUserFacingError,
  type FirestoreListenerFailureCategory,
  type FirestoreUnaryProbeResult,
} from '../../../shared/firebase/firestoreTransportDiagnostics';
import { validateCeqAccess, stringifyCeqAccessReport } from '../utils/validateCeqAccess';

const CEQ_POLL_MS = 8000;

type CeqUiErrorCategory = FirestoreListenerFailureCategory | 'none';

type StreamKind = 'participacoes' | 'amostras' | 'resultados';

async function primeAuthTokenForFirestore(): Promise<void> {
  try {
    await auth.currentUser?.getIdToken(true);
  } catch {
    /* ignore — snapshot still attempts with current session */
  }
}

async function readTokenModulesCeq(): Promise<boolean | null> {
  try {
    const u = auth.currentUser;
    if (!u) return null;
    const tr = await u.getIdTokenResult(true);
    const m = tr.claims?.modules as Record<string, unknown> | undefined;
    return typeof m?.ceq === 'boolean' ? m.ceq : null;
  } catch {
    return null;
  }
}

async function unaryProbeForStream(
  labId: string,
  kind: StreamKind,
  participacaoId: string | undefined,
  amostraId: string | undefined,
): Promise<FirestoreUnaryProbeResult> {
  try {
    if (kind === 'participacoes') {
      const q = query(
        collection(db, 'labs', labId, 'ceq-participacoes'),
        where('ativo', '==', true),
        where('deletadoEm', '==', null),
        limit(1),
      );
      const snap = await getDocs(q);
      return { status: 'ok', docCount: snap.size };
    }
    if (kind === 'amostras') {
      if (!participacaoId) {
        return { status: 'error', code: 'skipped', message: 'missing participacaoId' };
      }
      const q = query(
        collection(db, 'labs', labId, 'ceq-amostras'),
        where('ceqParticipacaoId', '==', participacaoId),
        where('deletadoEm', '==', null),
        limit(1),
      );
      const snap = await getDocs(q);
      return { status: 'ok', docCount: snap.size };
    }
    if (!amostraId) {
      return { status: 'error', code: 'skipped', message: 'missing amostraId' };
    }
    const q = query(
      collection(db, 'labs', labId, 'ceq-resultados'),
      where('ceqAmostraId', '==', amostraId),
      where('deletadoEm', '==', null),
      limit(1),
    );
    const snap = await getDocs(q);
    return { status: 'ok', docCount: snap.size };
  } catch (e: unknown) {
    if (e instanceof FirebaseError) {
      return { status: 'error', code: e.code, message: e.message };
    }
    return {
      status: 'error',
      code: 'unknown',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

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
  const [listenerEpoch, setListenerEpoch] = useState(0);
  const [realtimeDegraded, setRealtimeDegraded] = useState(false);
  const [ceqErrorCategory, setCeqErrorCategory] = useState<CeqUiErrorCategory>('none');
  const [ceqErrorTitle, setCeqErrorTitle] = useState<string | null>(null);

  const lastToastKeyRef = useRef<string | null>(null);
  const activeLab = useActiveLab();
  const uid = useAuthStore((s) => s.appProfile?.user?.uid ?? '');

  const emitCeqToastOnce = useCallback((key: string, message: string) => {
    if (lastToastKeyRef.current === key) return;
    lastToastKeyRef.current = key;
    toast.error(message);
  }, []);

  const applyListenerFailure = useCallback(
    async (params: {
      err: unknown;
      stream: StreamKind;
      labId: string;
      participacaoId?: string;
      amostraId?: string;
      /** Clear lists affected by this stream */
      clearParticipacoes?: boolean;
      clearAmostras?: boolean;
      clearResultados?: boolean;
    }) => {
      const { err, stream, labId, participacaoId, amostraId, clearParticipacoes, clearAmostras, clearResultados } =
        params;

      await primeAuthTokenForFirestore();
      const unaryProbe = await unaryProbeForStream(labId, stream, participacaoId, amostraId);
      const tokenClaimsCeqTrue = await readTokenModulesCeq();

      const { category, technicalCode, technicalMessage } = classifyFirestoreListenerError({
        err,
        unaryProbe,
        tokenClaimsCeqTrue,
      });
      const { title, body, copySlug } = formatCeqUserFacingError({ category });

      if (import.meta.env.DEV || globalThis.localStorage?.getItem('hcq_firebase_diag') === '1') {
        // eslint-disable-next-line no-console -- diagnóstico explícito sob flag DEV / localStorage
        console.warn('[CEQ listener]', {
          stream,
          category,
          technicalCode,
          technicalMessage,
          unaryProbe,
          tokenClaimsCeqTrue,
          copySlug,
        });
      }

      setCeqErrorCategory(category);
      setCeqErrorTitle(title);
      setState((s) => ({
        ...s,
        ...(clearParticipacoes ? { participacoes: [] } : {}),
        ...(clearAmostras ? { amostras: [] } : {}),
        ...(clearResultados ? { resultados: [] } : {}),
        error: body,
      }));

      if (category === 'transport_suspected') {
        setRealtimeDegraded(true);
      }

      emitCeqToastOnce(`${category}:${stream}`, `${title} ${body}`);
    },
    [emitCeqToastOnce],
  );

  const retryCeqFirestoreListeners = useCallback(async () => {
    try {
      lastToastKeyRef.current = null;
      setRealtimeDegraded(false);
      setCeqErrorCategory('none');
      setCeqErrorTitle(null);
      await auth.currentUser?.getIdToken(true);
      setState((s) => ({ ...s, error: null }));
      setListenerEpoch((e) => e + 1);
    } catch {
      toast.error('Não foi possível atualizar o token. Faça logout e login.');
    }
  }, []);

  const copyCeqDiagnostics = useCallback(async () => {
    if (!activeLab) {
      toast.error('Nenhum laboratório ativo.');
      return;
    }
    try {
      const report = await validateCeqAccess({ auth, db, labId: activeLab.id });
      const text = stringifyCeqAccessReport(report);
      await navigator.clipboard.writeText(text);
      toast.success('Diagnóstico CEQ copiado para a área de transferência.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar diagnóstico';
      toast.error(msg);
    }
  }, [activeLab]);

  // ─── Load participacoes (realtime or degraded polling) ───────────────────

  useEffect(() => {
    if (!activeLab) return;

    const labId = activeLab.id;
    let cancelled = false;

    if (realtimeDegraded) {
      let interval: ReturnType<typeof setInterval> | undefined;
      const tick = async () => {
        try {
          const list = await listarCEQParticipacoes(labId);
          if (!cancelled) {
            setState((s) => ({ ...s, participacoes: list, error: null }));
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro ao carregar participações (polling)';
          if (!cancelled) {
            setState((s) => ({ ...s, participacoes: [], error: msg }));
            toast.error(msg);
          }
        }
      };
      void tick();
      interval = setInterval(() => void tick(), CEQ_POLL_MS);
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', labId, 'ceq-participacoes'),
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
          setCeqErrorCategory('none');
          setCeqErrorTitle(null);
        },
        (err) => {
          void applyListenerFailure({
            err,
            stream: 'participacoes',
            labId,
            clearParticipacoes: true,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, listenerEpoch, realtimeDegraded, applyListenerFailure]);

  // ─── Load amostras when participacao selected ───────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedParticipacao) return;

    const labId = activeLab.id;
    const participacaoId = state.selectedParticipacao.id;
    let cancelled = false;

    if (realtimeDegraded) {
      let interval: ReturnType<typeof setInterval> | undefined;
      const tick = async () => {
        try {
          const amostras = await listarCEQAmostras(labId, participacaoId);
          if (!cancelled) setState((s) => ({ ...s, amostras, error: null }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro ao carregar amostras (polling)';
          if (!cancelled) {
            setState((s) => ({ ...s, amostras: [], error: msg }));
            toast.error(msg);
          }
        }
      };
      void tick();
      interval = setInterval(() => void tick(), CEQ_POLL_MS);
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', labId, 'ceq-amostras'),
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
          void applyListenerFailure({
            err,
            stream: 'amostras',
            labId,
            participacaoId,
            clearAmostras: true,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, state.selectedParticipacao, listenerEpoch, realtimeDegraded, applyListenerFailure]);

  // ─── Load resultados when amostra selected ───────────────────────────────

  useEffect(() => {
    if (!activeLab || !state.selectedAmostra) return;

    const labId = activeLab.id;
    const amostraId = state.selectedAmostra.id;
    let cancelled = false;

    if (realtimeDegraded) {
      let interval: ReturnType<typeof setInterval> | undefined;
      const tick = async () => {
        try {
          const resultados = await listarCEQResultados(labId, amostraId);
          if (!cancelled) setState((s) => ({ ...s, resultados, error: null }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro ao carregar resultados (polling)';
          if (!cancelled) {
            setState((s) => ({ ...s, resultados: [], error: msg }));
            toast.error(msg);
          }
        }
      };
      void tick();
      interval = setInterval(() => void tick(), CEQ_POLL_MS);
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await primeAuthTokenForFirestore();
      if (cancelled) return;

      const q = query(
        collection(db, 'labs', labId, 'ceq-resultados'),
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
          void applyListenerFailure({
            err,
            stream: 'resultados',
            labId,
            amostraId,
            clearResultados: true,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeLab, state.selectedAmostra, listenerEpoch, realtimeDegraded, applyListenerFailure]);

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

  const isCeqRbacBlocked = ceqErrorCategory === 'rbac';
  const isCeqTransportSuspected = ceqErrorCategory === 'transport_suspected';
  const showCeqAccessPanel = isCeqRbacBlocked || isCeqTransportSuspected;

  return {
    ...state,
    retryCeqFirestoreListeners,
    copyCeqDiagnostics,
    ceqRealtimeDegraded: realtimeDegraded,
    ceqErrorCategory,
    ceqErrorTitle,
    isCeqRbacBlocked,
    isCeqTransportSuspected,
    showCeqAccessPanel,
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
