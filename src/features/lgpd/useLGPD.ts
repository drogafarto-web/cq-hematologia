import { useCallback } from 'react';
import { functions } from '../../shared/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { useActiveLabId } from '../../store/useAuthStore';
import {
  subscribeSolicitacoes,
  subscribeDPIAs,
  subscribeLogsExclusao,
} from './lgpdService';
import type {
  SolicitacaoDados,
  DPIA,
  LogExclusao,
} from './types/LGPD';

/**
 * Hook para gerenciar operações LGPD (solicitações, DPIAs, exclusão).
 */
export function useLGPD() {
  const labId = useActiveLabId();

  const criarSolicitacao = useCallback(
    async (titular_id: string, titular_nome: string, titular_email: string, tipo: 'acesso' | 'retificacao' | 'exclusao' | 'portabilidade', motivo?: string) => {
      if (!labId) throw new Error('Lab ID não configurado');

      const fn = httpsCallable<any, any>(functions, 'criarSolicitacao');
      const result = await fn({
        labId,
        titular_id,
        titular_nome,
        titular_email,
        tipo,
        motivo,
      });

      return result.data;
    },
    [labId]
  );

  const processarExclusao = useCallback(
    async (solicitacaoId: string, usuario_id: string) => {
      if (!labId) throw new Error('Lab ID não configurado');

      const fn = httpsCallable<any, any>(functions, 'processarExclusao');
      const result = await fn({
        labId,
        solicitacaoId,
        usuario_id,
      });

      return result.data;
    },
    [labId]
  );

  const gerarDPIA = useCallback(
    async (titulo: string, descricao: string, dados_pessoais_processados: string[], riscos_identificados: string[]) => {
      if (!labId) throw new Error('Lab ID não configurado');

      const fn = httpsCallable<any, any>(functions, 'gerarDPIA');
      const result = await fn({
        labId,
        titulo,
        descricao,
        dados_pessoais_processados,
        riscos_identificados,
      });

      return result.data;
    },
    [labId]
  );

  const subscribeToSolicitacoes = useCallback(
    (callback: (solicitacoes: SolicitacaoDados[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeSolicitacoes(labId, callback, onError);
    },
    [labId]
  );

  const subscribeToDPIAs = useCallback(
    (callback: (dpias: DPIA[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeDPIAs(labId, callback, onError);
    },
    [labId]
  );

  const subscribeToExclusoes = useCallback(
    (callback: (exclusoes: LogExclusao[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeLogsExclusao(labId, callback, onError);
    },
    [labId]
  );

  return {
    criarSolicitacao,
    processarExclusao,
    gerarDPIA,
    subscribeToSolicitacoes,
    subscribeToDPIAs,
    subscribeToExclusoes,
  };
}
