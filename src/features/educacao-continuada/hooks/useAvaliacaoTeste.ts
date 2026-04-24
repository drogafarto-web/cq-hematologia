import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import { functions, httpsCallable } from '../../../shared/services/firebase';
import {
  subscribeAvaliacoesTeste,
  type SubscribeAvaliacoesTesteOptions,
} from '../services/ecFirebaseService';
import type { AvaliacaoTeste } from '../types/EducacaoContinuada';

export interface RespostaSubmissao {
  questaoId: string;
  opcaoId?: string;
  respostaTexto?: string;
}

export interface SubmeterTesteResult {
  avaliacaoTesteId: string;
  pontuacaoTotal: number;
  percentualAcerto: number;
  aprovado: boolean;
  temDissertativasPendentes: boolean;
}

export interface UseAvaliacaoTesteResult {
  avaliacoes: AvaliacaoTeste[];
  isLoading: boolean;
  error: Error | null;
  submeter: (params: {
    execucaoId: string;
    colaboradorId: string;
    respostas: RespostaSubmissao[];
  }) => Promise<SubmeterTesteResult>;
}

interface SubmeterWire {
  labId: string;
  execucaoId: string;
  colaboradorId: string;
  respostas: RespostaSubmissao[];
}
interface SubmeterResp {
  ok: true;
  avaliacaoTesteId: string;
  pontuacaoTotal: number;
  percentualAcerto: number;
  aprovado: boolean;
  temDissertativasPendentes: boolean;
}

const callSubmeter = httpsCallable<SubmeterWire, SubmeterResp>(functions, 'ec_submeterTeste');

function unwrapErr(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function useAvaliacaoTeste(
  options: SubscribeAvaliacoesTesteOptions = {},
): UseAvaliacaoTesteResult {
  const labId = useActiveLabId();
  const { execucaoId, colaboradorId } = options;

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoTeste[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setAvaliacoes([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeAvaliacoesTeste(
      labId,
      { execucaoId, colaboradorId },
      (list) => {
        setAvaliacoes(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [labId, execucaoId, colaboradorId]);

  const submeter = useCallback(
    async (params: {
      execucaoId: string;
      colaboradorId: string;
      respostas: RespostaSubmissao[];
    }): Promise<SubmeterTesteResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      try {
        const resp = await callSubmeter({ labId, ...params });
        return {
          avaliacaoTesteId: resp.data.avaliacaoTesteId,
          pontuacaoTotal: resp.data.pontuacaoTotal,
          percentualAcerto: resp.data.percentualAcerto,
          aprovado: resp.data.aprovado,
          temDissertativasPendentes: resp.data.temDissertativasPendentes,
        };
      } catch (err) {
        throw unwrapErr(err, 'Erro ao submeter teste.');
      }
    },
    [labId],
  );

  return { avaliacoes, isLoading, error, submeter };
}
