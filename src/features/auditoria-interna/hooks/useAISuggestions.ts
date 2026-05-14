/**
 * useAISuggestions — React hook for AI-powered audit suggestions
 *
 * Fetches and caches AI suggestions per indicador.
 * Provides loading/error state and a refresh function to force re-fetch.
 *
 * Pattern: matches useAuditorias hook style with useActiveLabId guard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import { getAISuggestion, type AISuggestion } from '../services/aiSuggestionService';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface UseAISuggestionsResult {
  suggestion: AISuggestion | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

// ──────────────────────────────────────────────────────────────────────────
// In-memory cache (persists across re-renders, cleared on page reload)
// ──────────────────────────────────────────────────────────────────────────

const suggestionCache = new Map<string, AISuggestion>();

function cacheKey(labId: string, indicadorId: string): string {
  return `${labId}::${indicadorId}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetches AI suggestion for a given indicador in the active lab.
 *
 * - Caches results per indicador (won't re-fetch if already cached)
 * - Returns null suggestion when labId is not available
 * - Provides refresh() to force re-fetch (bypasses cache)
 */
export function useAISuggestions(
  indicadorId: string,
  labId: string
): UseAISuggestionsResult {
  const activeLabId = useActiveLabId();
  const resolvedLabId = labId || activeLabId;

  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track current request to avoid stale updates
  const requestIdRef = useRef(0);

  const fetchSuggestion = useCallback(
    async (bypassCache = false) => {
      if (!resolvedLabId || !indicadorId) {
        setSuggestion(null);
        setLoading(false);
        setError(null);
        return;
      }

      const key = cacheKey(resolvedLabId, indicadorId);

      // Return cached value if available and not bypassing
      if (!bypassCache && suggestionCache.has(key)) {
        setSuggestion(suggestionCache.get(key)!);
        setLoading(false);
        setError(null);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const result = await getAISuggestion(resolvedLabId, indicadorId);

        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          suggestionCache.set(key, result);
          setSuggestion(result);
          setError(null);
        }
      } catch (err) {
        if (currentRequestId === requestIdRef.current) {
          const fetchError = err instanceof Error ? err : new Error(String(err));
          setError(fetchError);
          setSuggestion(null);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [resolvedLabId, indicadorId]
  );

  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    fetchSuggestion(false);
  }, [fetchSuggestion]);

  // Refresh function bypasses cache
  const refresh = useCallback(() => {
    fetchSuggestion(true);
  }, [fetchSuggestion]);

  return { suggestion, loading, error, refresh };
}
