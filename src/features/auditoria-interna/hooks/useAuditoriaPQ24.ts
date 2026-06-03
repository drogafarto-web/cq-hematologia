/**
 * Phase 11 PQ-24 hooks — Plano de Ação, Presença, Re-Auditoria
 *
 * Thin hooks wrapping service calls + local optimistic updates.
 * Error handling for callable failures (NC validation, NC closure, etc).
 */

import { useState } from 'react';
import { createPlanoAcao, createReAuditoria, registerPresenca } from '../services/auditoriaService';

export interface PlanoAcaoHookState {
  planos: Array<{ id: string; descricao: string; status: string }>;
  loading: boolean;
  error: Error | null;
}

/**
 * usePlanosAcao: Manage action plans for a given audit
 */
export function usePlanosAcao(labId: string, auditoriaId: string) {
  const [planos, setPlanos] = useState<PlanoAcaoHookState['planos']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPlano = async (input: {
    achadoId: string;
    descricao: string;
    responsavel: string;
    prazo: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const planoId = (await createPlanoAcao({
        labId,
        auditoriaId,
        ...input,
      })) as string;
      // Optimistic update
      setPlanos((prev) => [
        ...prev,
        {
          id: planoId,
          descricao: input.descricao,
          status: 'aberto',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { planos, loading, error, createPlano };
}

export interface PresencaHookState {
  reunioes: Array<{ id: string; reuniao: string }>;
  loading: boolean;
  error: Error | null;
}

/**
 * usePresenca: Manage meeting attendance (abertura/encerramento)
 */
export function usePresenca(labId: string, auditoriaId: string, sessaoId: string) {
  const [reunioes, setReunioes] = useState<PresencaHookState['reunioes']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerReuniao = async (input: {
    reuniao: 'abertura' | 'encerramento';
    participantes: Array<{ userId: string; nome: string; papel: string }>;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await registerPresenca({
        labId,
        auditoriaId,
        sessaoId,
        ...input,
      });
      // Optimistic update
      setReunioes((prev) => [...prev, { id: result.reuniaoId, reuniao: input.reuniao }]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { reunioes, loading, error, registerReuniao };
}

export interface ReAuditoriaChainItem {
  id: string;
  reAuditoriaDe?: string;
  status: string;
}

/**
 * useReAuditoriaChain: Fetch and render the re-audit chain (origin → current)
 */
export function useReAuditoriaChain(labId: string, auditoriaId: string) {
  const [chain, setChain] = useState<ReAuditoriaChainItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChain = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would query Firestore
      // following the reAuditoriaDe chain backwards from auditoriaId
      // until the root (no reAuditoriaDe field) is found.
      // For now, return empty (will be populated by realtime listener)
      setChain([]);
    } finally {
      setLoading(false);
    }
  };

  const createNewReAuditoria = async (input: {
    proximaAuditoriaPlanejada: number;
    responsavelTecnico: string;
    motivacao: string;
  }) => {
    setLoading(true);
    try {
      const result = await createReAuditoria({
        labId,
        auditoriaOriginalId: auditoriaId,
        ...input,
      });
      // Optimistic: add new audit to chain
      setChain((prev) => [
        ...prev,
        {
          id: result.auditoriaId,
          reAuditoriaDe: auditoriaId,
          status: 'planejada',
        },
      ]);
      return result;
    } finally {
      setLoading(false);
    }
  };

  return { chain, loading, loadChain, createNewReAuditoria };
}
