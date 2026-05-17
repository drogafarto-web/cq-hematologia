/**
 * personnel/hooks/useAutorizacoes.ts
 *
 * Hook reativo para Autorizações Formais.
 * Subscribe em `personnel/{labId}/autorizacoes` e deriva agrupamentos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  watchAutorizacoes,
  createAutorizacao,
  revogarAutorizacao,
  softDeleteAutorizacao,
} from '../services/autorizacaoService';
import type { AutorizacaoFormal, AutorizacaoFormalInput } from '../types/AutorizacaoFormal';

export interface UseAutorizacoesResult {
  autorizacoes: AutorizacaoFormal[];
  ativas: AutorizacaoFormal[];
  porColaborador: Map<string, AutorizacaoFormal[]>;
  loading: boolean;
  error: Error | null;
  create: (input: AutorizacaoFormalInput) => Promise<string>;
  revogar: (id: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useAutorizacoes(): UseAutorizacoesResult {
  const labId = useActiveLabId();
  const [autorizacoes, setAutorizacoes] = useState<AutorizacaoFormal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setAutorizacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = watchAutorizacoes(
      labId,
      (items) => {
        setAutorizacoes(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId]);

  const ativas = useMemo(
    () => autorizacoes.filter((a) => a.ativa),
    [autorizacoes],
  );

  const porColaborador = useMemo(() => {
    const map = new Map<string, AutorizacaoFormal[]>();
    for (const a of autorizacoes) {
      const list = map.get(a.colaboradorId) || [];
      list.push(a);
      map.set(a.colaboradorId, list);
    }
    return map;
  }, [autorizacoes]);

  const create = useCallback(
    async (input: AutorizacaoFormalInput) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return createAutorizacao(labId, input);
    },
    [labId],
  );

  const revogar = useCallback(
    async (id: string) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return revogarAutorizacao(labId, id);
    },
    [labId],
  );

  const softDelete = useCallback(
    async (id: string) => {
      if (!labId) throw new Error('Lab não selecionado.');
      return softDeleteAutorizacao(labId, id);
    },
    [labId],
  );

  return {
    autorizacoes,
    ativas,
    porColaborador,
    loading,
    error,
    create,
    revogar,
    softDelete,
  };
}
