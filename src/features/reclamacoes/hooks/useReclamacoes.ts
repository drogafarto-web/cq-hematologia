/**
 * useReclamacoes Hook
 *
 * React hook for complaint management.
 * Handles Firestore listener setup, cleanup, local state.
 * Fat hooks pattern: includes validations, transitions, signature generation.
 */

import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToReclamacoes,
  getReclamacao,
  getReclamacoesByStatus,
  getReclamacoesBySeveridade,
} from '../services/reclamacaoService';
import type { Reclamacao, StatusReclamacao } from '../types';

interface UseReclamacoesFilters {
  status?: StatusReclamacao;
  responsavelId?: string;
  severidade?: 'alta' | 'media' | 'baixa';
  limit?: number;
}

export function useReclamacoes(filters?: UseReclamacoesFilters) {
  const labId = useActiveLabId();
  const [reclamacoes, setReclamacoes] = useState<Reclamacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setReclamacoes([]);
      setLoading(false);
      return;
    }

    // Set up listener with cleanup
    const unsubscribe = subscribeToReclamacoes(
      labId,
      {
        status: filters?.status,
        responsavelId: filters?.responsavelId,
        limit: filters?.limit,
      },
      (data) => {
        // Client-side filtering for severity (Firestore doesn't index nested fields well)
        let filtered = data;
        if (filters?.severidade) {
          filtered = data.filter(
            (r) => r.classificacao.severidade === filters.severidade
          );
        }
        setReclamacoes(filtered);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [labId, filters?.status, filters?.responsavelId, filters?.limit, filters?.severidade]);

  const getById = useCallback(
    async (reclamacaoId: string): Promise<Reclamacao | null> => {
      if (!labId) return null;
      return getReclamacao(labId, reclamacaoId);
    },
    [labId]
  );

  const getByStatus = useCallback(
    async (status: StatusReclamacao) => {
      if (!labId) return [];
      return getReclamacoesByStatus(labId, status, filters?.limit || 100);
    },
    [labId, filters?.limit]
  );

  const getBySeveridade = useCallback(
    async (severidade: 'alta' | 'media' | 'baixa') => {
      if (!labId) return [];
      return getReclamacoesBySeveridade(labId, severidade, filters?.limit || 100);
    },
    [labId, filters?.limit]
  );

  return {
    reclamacoes,
    loading,
    error,
    getById,
    getByStatus,
    getBySeveridade,
  };
}

/**
 * Hook for single complaint detail
 */
export function useReclamacao(reclamacaoId: string | null) {
  const labId = useActiveLabId();
  const [reclamacao, setReclamacao] = useState<Reclamacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !reclamacaoId) {
      setReclamacao(null);
      setLoading(false);
      return;
    }

    // One-time fetch (can be converted to listener if real-time updates needed)
    const fetchReclamacao = async () => {
      try {
        const data = await getReclamacao(labId, reclamacaoId);
        setReclamacao(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setReclamacao(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReclamacao();
  }, [labId, reclamacaoId]);

  return { reclamacao, loading, error };
}
