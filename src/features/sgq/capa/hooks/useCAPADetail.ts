/**
 * Hook: useCAPADetail
 *
 * Real-time subscription to a single CAPA with all subcollections
 * (actions, verifications, audit trail). Auto-cleanup on unmount.
 *
 * Usage:
 *   const { capa, acoes, verificacoes, isLoading } = useCAPADetail(labId, capaId);
 */

import { useState, useEffect, useCallback } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { getCAPA, getAcoes, getVerificacoes, subscribeAcoes } from '../services/capaService';
import type { CAPA, CAParecao, Verificacao } from '../types';

export interface UseCAPADetailResult {
  capa: CAPA | null;
  acoes: CAParecao[];
  verificacoes: Verificacao[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for loading a single CAPA with all related data
 *
 * Data loading strategy:
 * - Root CAPA: fetch once (getCAPA)
 * - Actions: real-time subscription (subscribeAcoes)
 * - Verifications: fetch once (getVerificacoes) — immutable, no need for realtime
 *
 * @param labId - The lab ID (tenant)
 * @param capaId - The CAPA document ID
 * @returns { capa, acoes, verificacoes, isLoading, error }
 */
export function useCAPADetail(labId: string, capaId: string): UseCAPADetailResult {
  const [capa, setCapa] = useState<CAPA | null>(null);
  const [acoes, setAcoes] = useState<CAParecao[]>([]);
  const [verificacoes, setVerificacoes] = useState<Verificacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch root CAPA document
  const loadCAPA = useCallback(async () => {
    if (!labId || !capaId) {
      setError('Lab ID and CAPA ID are required');
      setIsLoading(false);
      return;
    }

    try {
      const capa = await getCAPA(labId, capaId);
      if (!capa) {
        setError('CAPA não encontrada');
        setIsLoading(false);
        return;
      }
      setCapa(capa);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar CAPA');
    }
  }, [labId, capaId]);

  // Fetch verifications (immutable, one-time fetch)
  const loadVerificacoes = useCallback(async () => {
    if (!labId || !capaId) return;

    try {
      const verificacoes = await getVerificacoes(labId, capaId);
      setVerificacoes(verificacoes);
    } catch (err: any) {
      console.error('Erro ao carregar verificações:', err);
      // Don't set error state for subcollection failures — main CAPA still loaded
    }
  }, [labId, capaId]);

  useEffect(() => {
    setIsLoading(true);

    // Load root CAPA and verifications in parallel
    const loadInitial = async () => {
      await Promise.all([loadCAPA(), loadVerificacoes()]);
      setIsLoading(false);
    };

    loadInitial().catch((err) => {
      console.error('Error loading CAPA detail:', err);
      setIsLoading(false);
    });
  }, [loadCAPA, loadVerificacoes]);

  // Subscribe to real-time action updates
  useEffect(() => {
    if (!labId || !capaId) return;

    let unsubscribe: Unsubscribe | null = null;

    try {
      unsubscribe = subscribeAcoes(
        labId,
        capaId,
        {},
        (acoes) => {
          setAcoes(acoes);
        },
        (err) => {
          console.error('Error subscribing to actions:', err);
          // Don't set error state for subcollection failures
        },
      );
    } catch (err: any) {
      console.error('Error setting up action subscription:', err);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [labId, capaId]);

  return { capa, acoes, verificacoes, isLoading, error };
}
