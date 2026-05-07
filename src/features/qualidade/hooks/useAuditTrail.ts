/**
 * useAuditTrail.ts
 *
 * Hook for managing audit trail state and pagination.
 * Handles:
 * - Filter state (modulo, operadorId, resultado)
 * - Pagination (page offset, limit)
 * - Data fetching via callGetAuditTrail
 * - Loading and error states
 * - Page navigation
 */

import { useCallback, useEffect, useState } from 'react';
import { callGetAuditTrail } from '../services/auditCallables';
import type { AuditEntry, CallGetAuditTrailResult } from '../services/auditCallables';
import type { AuditTrailFilters } from '../types/auditUI';
import type { LabId } from '../types/shared_refs';

interface UseAuditTrailOptions {
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseAuditTrailState {
  entries: AuditEntry[];
  total: number;
  hasMore: boolean;
  page: number;
  loading: boolean;
  error: Error | null;
  filters: AuditTrailFilters;
}

interface UseAuditTrailActions {
  setFilters: (filters: AuditTrailFilters) => void;
  updateFilter: (key: keyof AuditTrailFilters, value: any) => void;
  clearFilters: () => void;
  nextPage: () => void;
  prevPage: () => void;
  setPage: (page: number) => void;
  retry: () => void;
  refetch: () => void;
}

export function useAuditTrail(
  labId: LabId,
  options: UseAuditTrailOptions = {},
): [UseAuditTrailState, UseAuditTrailActions] {
  const pageSize = options.pageSize ?? 50;
  const autoFetch = options.autoFetch !== false;

  // State
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPageState] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<AuditTrailFilters>({});

  // Fetch entries
  const fetch = useCallback(
    async (currentPage: number) => {
      if (!labId) {
        setError(new Error('Lab ID is required'));
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const offset = currentPage * pageSize;
        const result: CallGetAuditTrailResult = await callGetAuditTrail({
          labId,
          modulo: filters.modulo,
          operadorId: filters.operadorId,
          resultado: filters.resultado,
          offset,
          limit: pageSize,
        });

        setEntries(result.entries);
        setTotal(result.count);
        setHasMore(result.hasMore);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar auditoria';
        setError(new Error(errorMsg));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [labId, filters, pageSize],
  );

  // Auto-fetch on mount and when page/filters change
  useEffect(() => {
    if (autoFetch) {
      fetch(page);
    }
  }, [page, filters, fetch, autoFetch]);

  // Actions
  const actions: UseAuditTrailActions = {
    setFilters: (newFilters) => {
      setFilters(newFilters);
      setPageState(0);
    },

    updateFilter: (key, value) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value || undefined,
      }));
      setPageState(0);
    },

    clearFilters: () => {
      setFilters({});
      setPageState(0);
    },

    nextPage: () => {
      if (hasMore) {
        setPageState((p) => p + 1);
      }
    },

    prevPage: () => {
      if (page > 0) {
        setPageState((p) => p - 1);
      }
    },

    setPage: (newPage) => {
      setPageState(Math.max(0, newPage));
    },

    retry: () => {
      fetch(page);
    },

    refetch: () => {
      setPageState(0);
      fetch(0);
    },
  };

  const state: UseAuditTrailState = {
    entries,
    total,
    hasMore,
    page,
    loading,
    error,
    filters,
  };

  return [state, actions];
}
