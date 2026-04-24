import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import {
  restoreAvaliacaoCompetencia,
  softDeleteAvaliacaoCompetencia,
  subscribeAvaliacoesCompetencia,
  type SubscribeAvaliacoesCompetenciaOptions,
} from '../services/ecFirebaseService';
import { functions, httpsCallable, Timestamp } from '../../../shared/services/firebase';
import type {
  AvaliacaoCompetencia,
  MetodoAvaliacaoCompetencia,
  ResultadoCompetencia,
} from '../types/EducacaoContinuada';

export interface RegistrarAvaliacaoCompetenciaParams {
  execucaoId: string;
  colaboradorId: string;
  metodo: MetodoAvaliacaoCompetencia;
  resultado: ResultadoCompetencia;
  evidencia: string;
  dataAvaliacao: Timestamp;
  proximaAvaliacaoEm?: Timestamp;
}

export interface UseAvaliacaoCompetenciaResult {
  avaliacoes: AvaliacaoCompetencia[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  /**
   * Cria avaliação aplicando a sub-regra ISO 15189: resultado "reprovado"
   * exige `proximaAvaliacaoEm`. `avaliadorId` é injetado server-side a partir
   * do `auth.uid` da callable — cliente não envia.
   */
  registrar: (params: RegistrarAvaliacaoCompetenciaParams) => Promise<string>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

// ─── Wire da callable ────────────────────────────────────────────────────────

interface RegistrarCompetenciaWire {
  labId: string;
  execucaoId: string;
  colaboradorId: string;
  metodo: MetodoAvaliacaoCompetencia;
  resultado: ResultadoCompetencia;
  evidencia: string;
  dataAvaliacao: number;
  proximaAvaliacaoEm?: number;
}
interface RegistrarCompetenciaResp {
  ok: true;
  avaliacaoId: string;
}

const callRegistrar = httpsCallable<RegistrarCompetenciaWire, RegistrarCompetenciaResp>(
  functions,
  'ec_registrarAvaliacaoCompetencia',
);

function unwrapCallableError(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

export function useAvaliacaoCompetencia(
  options: SubscribeAvaliacoesCompetenciaOptions = {},
): UseAvaliacaoCompetenciaResult {
  const labId = useActiveLabId();
  const user = useUser();
  const { includeDeleted = false, execucaoId, colaboradorId } = options;

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoCompetencia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!labId) {
      setAvaliacoes([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeAvaliacoesCompetencia(
      labId,
      { includeDeleted, execucaoId, colaboradorId },
      (list) => {
        setAvaliacoes(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, includeDeleted, execucaoId, colaboradorId]);

  const registrar = useCallback(
    async (params: RegistrarAvaliacaoCompetenciaParams): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user) throw new Error('Usuário não autenticado.');
      if (params.evidencia.trim().length === 0) throw new Error('Evidência é obrigatória.');
      // ISO 15189 client check (UX); server re-aplica
      if (params.resultado === 'reprovado' && !params.proximaAvaliacaoEm) {
        throw new Error(
          'Resultado "reprovado" exige data de próxima avaliação (plano de retreinamento).',
        );
      }

      setIsSaving(true);
      setError(null);
      try {
        const resp = await callRegistrar({
          labId,
          execucaoId: params.execucaoId,
          colaboradorId: params.colaboradorId,
          metodo: params.metodo,
          resultado: params.resultado,
          evidencia: params.evidencia.trim(),
          dataAvaliacao: params.dataAvaliacao.toMillis(),
          proximaAvaliacaoEm: params.proximaAvaliacaoEm?.toMillis(),
        });
        setIsSaving(false);
        return resp.data.avaliacaoId;
      } catch (err) {
        const e = unwrapCallableError(err, 'Erro ao registrar avaliação.');
        setError(e);
        setIsSaving(false);
        throw e;
      }
    },
    [labId, user],
  );

  const softDelete = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return softDeleteAvaliacaoCompetencia(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreAvaliacaoCompetencia(labId, id);
    },
    [labId],
  );

  return { avaliacoes, isLoading, error, isSaving, registrar, softDelete, restore };
}
