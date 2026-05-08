/**
 * useCriticosEscalacoes
 *
 * Subscribes to /labs/{labId}/criticos-escalacoes (Phase 6) — server-only
 * writes via Cloud Function (registerCriticoDetection / acknowledgeEscalacao).
 * Client read is allowed for RT/admin/auditor (firestore.rules line 1838).
 *
 * Acknowledgment fires the `acknowledgeEscalacao` callable. The callable is
 * currently disabled in functions/src/index.ts (commented out — Phase 15
 * Twilio enable). When the callable returns `unimplemented` / `internal`,
 * the hook surfaces a clear error so the UI can render a friendly hint
 * instead of swallowing the failure.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  db,
  functions,
  httpsCallable,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import type { CriticosEscalacao } from '../types';

const callAck = httpsCallable<
  {
    labId: string;
    escalacaoId: string;
    acknowledgedBy: string;
    method: 'portal_web' | 'webhook_twilio' | 'manual_rt';
    notas?: string;
  },
  {
    success: boolean;
    escalacaoId: string;
    status: 'reconhecido';
    tempoSlaMs: number;
    slaStatus: 'em_prazo' | 'vencido';
  }
>(functions, 'acknowledgeEscalacao');

interface AckPayload {
  escalacaoId: string;
  notas?: string;
}

export interface UseCriticosEscalacoesResult {
  escalacoes: CriticosEscalacao[];
  pendentes: CriticosEscalacao[];
  reconhecidas: CriticosEscalacao[];
  isLoading: boolean;
  error: Error | null;
  acknowledge: (payload: AckPayload) => Promise<void>;
}

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function useCriticosEscalacoes(): UseCriticosEscalacoesResult {
  const labId = useActiveLabId();
  const user = useUser();
  const [escalacoes, setEscalacoes] = useState<CriticosEscalacao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setEscalacoes([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const colRef = collection(db, 'labs', labId, 'criticos-escalacoes');
    const q = query(colRef, orderBy('criadoEm', 'desc'));

    let unsub: Unsubscribe | null = null;
    try {
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: CriticosEscalacao[] = [];
          snap.forEach((doc) => {
            const data = doc.data() as CriticosEscalacao;
            if (data.deletadoEm) return;
            list.push({ ...data, id: doc.id });
          });
          setEscalacoes(list);
          setIsLoading(false);
        },
        (err) => {
          setError(toError(err, 'Falha ao carregar escalações'));
          setIsLoading(false);
        },
      );
    } catch (err) {
      setError(toError(err, 'Falha ao subscrever escalações'));
      setIsLoading(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [labId]);

  const acknowledge = useCallback(
    async ({ escalacaoId, notas }: AckPayload): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user?.uid) throw new Error('Usuário não autenticado.');
      try {
        await callAck({
          labId,
          escalacaoId,
          acknowledgedBy: user.uid,
          method: 'portal_web',
          notas,
        });
      } catch (err) {
        throw toError(
          err,
          'Falha ao reconhecer escalação. Confirme com o administrador se o módulo de comunicação está ativo.',
        );
      }
    },
    [labId, user?.uid],
  );

  const pendentes = useMemo(
    () => escalacoes.filter((e) => e.status === 'enviado'),
    [escalacoes],
  );
  const reconhecidas = useMemo(
    () => escalacoes.filter((e) => e.status !== 'enviado'),
    [escalacoes],
  );

  return {
    escalacoes,
    pendentes,
    reconhecidas,
    isLoading,
    error,
    acknowledge,
  };
}
