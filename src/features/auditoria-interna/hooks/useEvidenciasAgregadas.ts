/**
 * useEvidenciasAgregadas hook
 *
 * Fetches aggregated evidence for a given FR-044 indicator from other
 * HC Quality modules. Caches results for 5 minutes to avoid redundant
 * Firestore reads on re-render.
 *
 * Pattern follows existing hooks in auditoria-interna module:
 * - useState/useEffect with cleanup
 * - Error handling with typed Error state
 * - Guard on labId presence
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchEvidenciasParaIndicador,
  type EvidenciaAgregada,
} from '../services/evidenceAggregatorService';

// ──────────────────────────────────────────────────────────────────────────
// Cache layer (5-minute TTL, shared across hook instances)
// ──────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: EvidenciaAgregada[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCacheKey(labId: string, indicadorId: string): string {
  return `${labId}::${indicadorId}`;
}

function getCachedData(labId: string, indicadorId: string): EvidenciaAgregada[] | null {
  const key = getCacheKey(labId, indicadorId);
  const entry = cache.get(key);

  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedData(labId: string, indicadorId: string, data: EvidenciaAgregada[]): void {
  const key = getCacheKey(labId, indicadorId);
  cache.set(key, { data, timestamp: Date.now() });
}

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

export interface UseEvidenciasAgregadasResult {
  evidencias: EvidenciaAgregada[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch aggregated evidence for a checklist indicator.
 *
 * @param indicadorId - FR-044 indicator ID (key in MODULE_MAPPINGS)
 * @param labId - Active laboratory ID
 * @returns Object with evidencias array, loading state, error, and refetch function
 */
export function useEvidenciasAgregadas(
  indicadorId: string,
  labId: string,
): UseEvidenciasAgregadasResult {
  const [evidencias, setEvidencias] = useState<EvidenciaAgregada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track current fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(
    async (skipCache = false) => {
      if (!labId || !indicadorId) {
        setEvidencias([]);
        setLoading(false);
        setError(null);
        return;
      }

      // Check cache first (unless explicitly skipping)
      if (!skipCache) {
        const cached = getCachedData(labId, indicadorId);
        if (cached) {
          setEvidencias(cached);
          setLoading(false);
          setError(null);
          return;
        }
      }

      const currentFetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const result = await fetchEvidenciasParaIndicador(labId, indicadorId);

        // Only update state if this is still the latest fetch and component is mounted
        if (mountedRef.current && currentFetchId === fetchIdRef.current) {
          setCachedData(labId, indicadorId, result);
          setEvidencias(result);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current && currentFetchId === fetchIdRef.current) {
          const fetchError = err instanceof Error ? err : new Error(String(err));
          setError(fetchError);
          setEvidencias([]);
          setLoading(false);
        }
      }
    },
    [labId, indicadorId],
  );

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manual refetch (bypasses cache)
  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { evidencias, loading, error, refetch };
}
