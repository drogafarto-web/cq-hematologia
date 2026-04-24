import { useCallback, useState } from 'react';

import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { functions, httpsCallable, Timestamp } from '../../../shared/services/firebase';
import type { Execucao, Treinamento } from '../types/EducacaoContinuada';

/** Presença reportada pela UI — assinatura é gerada server-side. */
export interface PresencaInput {
  colaboradorId: string;
  presente: boolean;
}

export interface RealizarExecucaoParams {
  /** null → cria uma execução nova já no estado 'realizado'. */
  execucaoId: string | null;
  treinamento: Treinamento;
  dataPlanejada: Timestamp;
  dataAplicacao: Timestamp;
  ministrante: string;
  pauta: string;
  presencas: PresencaInput[];
  /** Antecedência padrão do alerta de vencimento — configurável por tenant na FASE 5. */
  diasAntecedenciaAlerta: number;
}

export interface AdiarExecucaoParams {
  execucaoOriginal: Execucao;
  novaDataPlanejada: Timestamp;
  motivo: string;
}

/** Espelho dos returns das callables — contratos preservados pra callers atuais. */
export interface CommitExecucaoRealizadaResult {
  execucaoId: string;
  participanteIds: string[];
  alertaId: string;
}

export interface CommitExecucaoAdiadaResult {
  novaExecucaoId: string;
}

export interface UseSaveExecucaoResult {
  /**
   * Registra execução realizada (RN-03 + RN-05). Validações canônicas no server;
   * cliente preserva check rápido de RN-03 para UX (evita round-trip se óbvio).
   */
  realizar: (params: RealizarExecucaoParams) => Promise<CommitExecucaoRealizadaResult>;

  /**
   * Adia execução (RN-01). Marca a original como 'adiado' e cria nova
   * execução 'planejado' com `origemReagendamento` preenchido. Atomic server-side.
   */
  adiar: (params: AdiarExecucaoParams) => Promise<CommitExecucaoAdiadaResult>;

  isSaving: boolean;
  error: Error | null;
}

// ─── Wire dos callables ──────────────────────────────────────────────────────

interface CommitRealizadaWire {
  labId: string;
  execucaoId: string | null;
  treinamentoId: string;
  dataPlanejada: number;
  dataAplicacao: number;
  ministrante: string;
  pauta: string;
  presencas: PresencaInput[];
  diasAntecedenciaAlerta: number;
}
interface CommitRealizadaResp {
  ok: true;
  execucaoId: string;
  participanteIds: string[];
  alertaId: string;
}

interface CommitAdiadaWire {
  labId: string;
  execucaoOriginalId: string;
  novaDataPlanejada: number;
  motivo: string;
}
interface CommitAdiadaResp {
  ok: true;
  novaExecucaoId: string;
}

const callCommitRealizada = httpsCallable<CommitRealizadaWire, CommitRealizadaResp>(
  functions,
  'ec_commitExecucaoRealizada',
);

const callCommitAdiada = httpsCallable<CommitAdiadaWire, CommitAdiadaResp>(
  functions,
  'ec_commitExecucaoAdiada',
);

/** Mapeia FirebaseError de callable em Error com `message` legível pra UI. */
function unwrapCallableError(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message);
    return new Error(msg);
  }
  return new Error(fallback);
}

/**
 * Orquestra transições complexas de status de Execucao via callables Cloud
 * Functions (Fase 0b). Validações regulatórias rodam no server; este hook
 * preserva o contrato anterior + checks rápidos client-side para UX.
 */
export function useSaveExecucao(): UseSaveExecucaoResult {
  const labId = useActiveLabId();
  const user = useUser();

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const realizar = useCallback(
    async (params: RealizarExecucaoParams): Promise<CommitExecucaoRealizadaResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user) throw new Error('Usuário não autenticado.');

      // Checks de UX — RN-03 canônico fica no server
      const presentes = params.presencas.filter((p) => p.presente);
      if (presentes.length === 0) {
        throw new Error(
          'RN-03: ao menos 1 colaborador presente é obrigatório para registrar execução como realizada.',
        );
      }
      if (params.ministrante.trim().length === 0) {
        throw new Error('Ministrante é obrigatório para execução realizada.');
      }
      if (params.pauta.trim().length === 0) {
        throw new Error('Pauta é obrigatória para execução realizada.');
      }

      setIsSaving(true);
      setError(null);

      try {
        const resp = await callCommitRealizada({
          labId,
          execucaoId: params.execucaoId,
          treinamentoId: params.treinamento.id,
          dataPlanejada: params.dataPlanejada.toMillis(),
          dataAplicacao: params.dataAplicacao.toMillis(),
          ministrante: params.ministrante.trim(),
          pauta: params.pauta.trim(),
          presencas: params.presencas,
          diasAntecedenciaAlerta: params.diasAntecedenciaAlerta,
        });

        setIsSaving(false);
        return {
          execucaoId: resp.data.execucaoId,
          participanteIds: resp.data.participanteIds,
          alertaId: resp.data.alertaId,
        };
      } catch (err) {
        const e = unwrapCallableError(err, 'Erro ao salvar execução.');
        setError(e);
        setIsSaving(false);
        throw e;
      }
    },
    [labId, user],
  );

  const adiar = useCallback(
    async (params: AdiarExecucaoParams): Promise<CommitExecucaoAdiadaResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      if (!user) throw new Error('Usuário não autenticado.');
      if (params.motivo.trim().length === 0) {
        throw new Error('Motivo do adiamento é obrigatório.');
      }
      if (
        params.novaDataPlanejada.toMillis() <=
        params.execucaoOriginal.dataPlanejada.toMillis()
      ) {
        throw new Error('Nova data precisa ser posterior à data planejada original.');
      }

      setIsSaving(true);
      setError(null);

      try {
        const resp = await callCommitAdiada({
          labId,
          execucaoOriginalId: params.execucaoOriginal.id,
          novaDataPlanejada: params.novaDataPlanejada.toMillis(),
          motivo: params.motivo.trim(),
        });

        setIsSaving(false);
        return { novaExecucaoId: resp.data.novaExecucaoId };
      } catch (err) {
        const e = unwrapCallableError(err, 'Erro ao adiar execução.');
        setError(e);
        setIsSaving(false);
        throw e;
      }
    },
    [labId, user],
  );

  return { realizar, adiar, isSaving, error };
}
