/**
 * Hook: useCAPAList
 *
 * Real-time subscription to CAPAs in a lab with optional filtering by status and assignee.
 * Auto-cleanup on unmount. Type-safe with full CAPA[] typing.
 *
 * Usage:
 *   const { capas, isLoading, error } = useCAPAList(labId, {status: 'aberta'});
 */

import { useState, useEffect } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { subscribeCAPAs } from '../services/capaService';
import type { CAPA, CAPAFilters } from '../types';

export interface UseCAPAListOptions extends CAPAFilters {
  assigneeId?: string; // Filter by responsible user (maps to criadoPor for now)
}

export interface UseCAPAListResult {
  capas: CAPA[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for real-time CAPA list with filtering
 *
 * @param labId - The lab ID (tenant)
 * @param options - Filter options (status, assigneeId, etc)
 * @returns { capas, isLoading, error }
 */
export function useCAPAList(
  labId: string,
  options?: UseCAPAListOptions
): UseCAPAListResult {
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      setError('Lab ID is required');
      return;
    }

    // Build filters object for service
    const filters: CAPAFilters = {
      status: options?.status,
      prioridade: options?.prioridade,
      encontroId: options?.encontroId,
      searchTerm: options?.searchTerm,
      // Note: assigneeId maps to criadoPor in the current schema
      criadoPor: options?.assigneeId,
    };

    // Subscribe to real-time updates
    let unsubscribe: Unsubscribe | null = null;

    try {
      unsubscribe = subscribeCAPAs(
        labId,
        filters,
        (data) => {
          setCapas(data);
          setIsLoading(false);
          setError(null);
        },
        (err) => {
          setError(err.message || 'Erro ao carregar CAPAs');
          setIsLoading(false);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar subscription');
      setIsLoading(false);
    }

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [labId, options?.status, options?.prioridade, options?.encontroId, options?.assigneeId, options?.searchTerm]);

  return { capas, isLoading, error };
}
