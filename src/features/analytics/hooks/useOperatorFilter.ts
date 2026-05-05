/**
 * Hook: Operator multi-select filter for analytics dashboards
 *
 * Fetches active operators (colaboradores) from /labs/{labId}/colaboradores.
 * Same multi-select pattern as useEquipmentFilter.
 *
 * Multi-tenant: labId scoped query, deletadoEm == null soft-delete filter.
 * Path convention follows educacao-continuada module (canonical colaboradores ref).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OperatorItem {
  id: string;
  name: string;
}

export interface OperatorFilterState {
  operators: OperatorItem[];
  selectedIds: Set<string>;
  toggleOperator: (id: string) => void;
  clearOperator: () => void;
  isFiltering: boolean;
  isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns operator list from Firestore + multi-select filter state.
 *
 * Uses /labs/{labId}/colaboradores — the canonical operator collection
 * (same as educacao-continuada module; confirmed from ecFirebaseService.ts).
 *
 * selectedIds.size > 0 means filtering is active (isFiltering = true).
 */
export function useOperatorFilter(): OperatorFilterState {
  const labId = useActiveLabId();
  const [operators, setOperators] = useState<OperatorItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!labId) {
      setOperators([]);
      return;
    }

    setIsLoading(true);

    // Path mirrors educacao-continuada's colaboradoresCol(labId)
    const col = collection(db, 'labs', labId, 'colaboradores');
    // Soft-delete guard — filter by deletadoEm == null (active collaborators only)
    const q = query(col, where('deletadoEm', '==', null));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: OperatorItem[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.nome ?? data.name ?? doc.id,
          };
        });
        // Sort alphabetically for stable dropdown
        items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setOperators(items);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[useOperatorFilter] Firestore error:', err);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const toggleOperator = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearOperator = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    operators,
    selectedIds,
    toggleOperator,
    clearOperator,
    isFiltering: selectedIds.size > 0,
    isLoading,
  };
}
