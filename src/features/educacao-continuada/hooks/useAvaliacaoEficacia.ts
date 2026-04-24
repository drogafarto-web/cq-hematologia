import { useCallback, useEffect, useState } from 'react';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import {
  restoreAvaliacaoEficacia,
  softDeleteAvaliacaoEficacia,
  subscribeAvaliacoesEficacia,
  type SubscribeAvaliacoesEficaciaOptions,
} from '../services/ecFirebaseService';
import { functions, httpsCallable, Timestamp } from '../../../shared/services/firebase';
import type {
  AvaliacaoEficacia,
  AvaliacaoEficaciaInput,
} from '../types/EducacaoContinuada';

export interface RegistrarAvaliacaoEficaciaParams {
  execucaoId: string;
  resultado: AvaliacaoEficacia['resultado'];
  evidencia: string;
  dataAvaliacao: Timestamp;
  acaoCorretiva?: string;
  /** Quando true, seta `dataFechamento = serverNow`. RN-02 bloqueia se ineficaz sem ação corretiva. */
  fechar: boolean;
}

export interface UseAvaliacaoEficaciaResult {
  avaliacoes: AvaliacaoEficacia[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  /** Cria avaliação aplicando RN-02 (ineficaz + fechar → acaoCorretiva obrigatória). */
  registrar: (params: RegistrarAvaliacaoEficaciaParams) => Promise<string>;
  /** Fecha avaliação existente — aplica RN-02 novamente antes de escrever. */
  fechar: (avaliacao: AvaliacaoEficacia, acaoCorretiva?: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
}

// ─── Wire dos callables ──────────────────────────────────────────────────────

interface RegistrarEficaciaWire {
  labId: string;
  execucaoId: string;
  resultado: AvaliacaoEficacia['resultado'];
  evidencia: string;
  dataAvaliacao: number;
  acaoCorretiva?: string;
  fechar: boolean;
}
interface RegistrarEficaciaResp {
  ok: true;
  avaliacaoId: string;
}

interface FecharEficaciaWire {
  labId: string;
  avaliacaoId: string;
  acaoCorretiva?: string;
}
interface FecharEficaciaResp {
  ok: true;
}

const callRegistrar = httpsCallable<RegistrarEficaciaWire, RegistrarEficaciaResp>(
  functions,
  'ec_registrarAvaliacaoEficacia',
);
const callFechar = httpsCallable<FecharEficaciaWire, FecharEficaciaResp>(
  functions,
  'ec_fecharAvaliacaoEficacia',
);

function unwrapCallableError(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String((err as { message: unknown }).message));
  }
  return new Error(fallback);
}

/**
 * Hook de avaliações de eficácia (FR-001 inferior). Criação e fechamento via
 * callables Cloud Functions (Fase 0b — assinatura server-side). Subscribe e
 * soft-delete continuam client-side.
 */
export function useAvaliacaoEficacia(
  options: SubscribeAvaliacoesEficaciaOptions = {},
): UseAvaliacaoEficaciaResult {
  const labId = useActiveLabId();
  const user = useUser();
  const { includeDeleted = false, execucaoId } = options;

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoEficacia[]>([]);
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

    const unsubscribe = subscribeAvaliacoesEficacia(
      labId,
      { includeDeleted, execucaoId },
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
  }, [labId, includeDeleted, execucaoId]);

  const registrar = useCallback(
    async (params: RegistrarAvaliacaoEficaciaParams): Promise<string> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user) throw new Error('Usuário não autenticado.');
      if (params.evidencia.trim().length === 0) throw new Error('Evidência é obrigatória.');
      // RN-02 client check (UX); server re-aplica
      if (
        params.resultado === 'ineficaz' &&
        params.fechar &&
        (!params.acaoCorretiva || params.acaoCorretiva.trim().length === 0)
      ) {
        throw new Error(
          'RN-02: avaliação ineficaz não pode ser fechada sem ação corretiva preenchida.',
        );
      }

      setIsSaving(true);
      setError(null);
      try {
        const resp = await callRegistrar({
          labId,
          execucaoId: params.execucaoId,
          resultado: params.resultado,
          evidencia: params.evidencia.trim(),
          dataAvaliacao: params.dataAvaliacao.toMillis(),
          acaoCorretiva: params.acaoCorretiva?.trim() || undefined,
          fechar: params.fechar,
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

  const fechar = useCallback(
    async (avaliacao: AvaliacaoEficacia, acaoCorretiva?: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user) throw new Error('Usuário não autenticado.');

      // Check rápido client-side; server re-valida
      const acao = (acaoCorretiva ?? avaliacao.acaoCorretiva ?? '').trim();
      if (avaliacao.resultado === 'ineficaz' && acao.length === 0) {
        throw new Error(
          'RN-02: avaliação ineficaz não pode ser fechada sem ação corretiva preenchida.',
        );
      }

      setIsSaving(true);
      try {
        await callFechar({
          labId,
          avaliacaoId: avaliacao.id,
          acaoCorretiva: acao.length > 0 ? acao : undefined,
        });
        setIsSaving(false);
      } catch (err) {
        const e = unwrapCallableError(err, 'Erro ao fechar avaliação.');
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
      return softDeleteAvaliacaoEficacia(labId, id);
    },
    [labId],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      if (!labId) throw new Error('Sem lab ativo.');
      return restoreAvaliacaoEficacia(labId, id);
    },
    [labId],
  );

  return { avaliacoes, isLoading, error, isSaving, registrar, fechar, softDelete, restore };
}
