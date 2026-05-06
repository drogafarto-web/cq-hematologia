/**
 * useSugestoes Hook
 *
 * React hook for suggestion management.
 * Handles Firestore listener setup, cleanup, local state.
 */

import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToSugestoes,
  getSugestao,
  getSugestoesByStatus,
  getTopVotedSugestoes,
} from '../services/sugestaoService';
import type { Sugestao, StatusSugestao } from '../types';

interface UseSugestoesFilters {
  status?: StatusSugestao;
  limit?: number;
}

export function useSugestoes(filters?: UseSugestoesFilters) {
  const labId = useActiveLabId();
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setSugestoes([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToSugestoes(
      labId,
      {
        status: filters?.status,
        limit: filters?.limit,
      },
      (data) => {
        setSugestoes(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, filters?.status, filters?.limit]);

  const getById = useCallback(
    async (sugestaoId: string): Promise<Sugestao | null> => {
      if (!labId) return null;
      return getSugestao(labId, sugestaoId);
    },
    [labId]
  );

  const getByStatus = useCallback(
    async (status: StatusSugestao) => {
      if (!labId) return [];
      return getSugestoesByStatus(labId, status, filters?.limit || 100);
    },
    [labId, filters?.limit]
  );

  const getTopVoted = useCallback(
    async (limitCount = 20) => {
      if (!labId) return [];
      return getTopVotedSugestoes(labId, limitCount);
    },
    [labId]
  );

  return {
    sugestoes,
    loading,
    error,
    getById,
    getByStatus,
    getTopVoted,
  };
}

/**
 * Hook for single suggestion detail
 */
export function useSugestao(sugestaoId: string | null) {
  const labId = useActiveLabId();
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !sugestaoId) {
      setSugestao(null);
      setLoading(false);
      return;
    }

    const fetchSugestao = async () => {
      try {
        const data = await getSugestao(labId, sugestaoId);
        setSugestao(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setSugestao(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSugestao();
  }, [labId, sugestaoId]);

  return { sugestao, loading, error };
}
