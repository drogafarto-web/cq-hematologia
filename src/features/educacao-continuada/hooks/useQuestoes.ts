import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import {
  subscribeQuestoes,
  type SubscribeQuestoesOptions,
} from '../services/ecFirebaseService';
import type { Questao, QuestaoInput } from '../types/EducacaoContinuada';

export interface UseQuestoesResult {
  questoes: Questao[];
  isLoading: boolean;
  error: Error | null;
  /** Cria questão via callable — separa gabarito em coleção restrita (RN-10). */
  criar: (input: QuestaoInput) => Promise<string>;
  /** Arquiva questão (ativo=false) via callable — preserva gabarito para histórico. */
  arquivar: (questaoId: string) => Promise<void>;
}

interface CriarQuestaoWire {
  labId: string;
  templateId: string;
  enunciado: string;
  tipo: Questao['tipo'];
  opcoes?: Array<{ texto: string; correta: boolean }>;
  gabaritoTexto?: string;
  pontuacao: number;
  ordem: number;
  ativo: boolean;
}
interface CriarQuestaoResp {
  ok: true;
  questaoId: string;
}

interface ArquivarWire {
  labId: string;
  questaoId: string;
}

const callCriar = httpsCallable<CriarQuestaoWire, CriarQuestaoResp>(functions, 'ec_criarQuestao');
const callArquivar = httpsCallable<ArquivarWire, { ok: true }>(functions, 'ec_arquivarQuestao');

function unwrapErr(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function useQuestoes(options: SubscribeQuestoesOptions = {}): UseQuestoesResult {
  const labId = useActiveLabId();
  const { templateId, somenteAtivas = false } = options;

  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setQuestoes([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeQuestoes(
      labId,
      { templateId, somenteAtivas },
      (list) => {
        setQuestoes(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [labId, templateId, somenteAtivas]);

  const criar = useCallback(
    async (input: QuestaoInput): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        const resp = await callCriar({ labId, ...input });
        return resp.data.questaoId;
      } catch (err) {
        throw unwrapErr(err, 'Erro ao criar questão.');
      }
    },
    [labId],
  );

  const arquivar = useCallback(
    async (questaoId: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        await callArquivar({ labId, questaoId });
      } catch (err) {
        throw unwrapErr(err, 'Erro ao arquivar questão.');
      }
    },
    [labId],
  );

  return { questoes, isLoading, error, criar, arquivar };
}
