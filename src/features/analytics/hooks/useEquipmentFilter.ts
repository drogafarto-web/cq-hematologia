/**
 * Hook: Equipment multi-select filter for analytics dashboards
 *
 * Fetches active equipment list from /labs/{labId}/equipamentos.
 * Provides multi-select state: toggle individual equipment or clear all.
 *
 * Filtering is applied client-side (aggregates are small; post-process on
 * merged aggregate data — not Firestore query-side).
 *
 * Multi-tenant: labId scoped query, deletadoEm == null soft-delete filter.
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

export interface EquipmentItem {
  id: string;
  name: string;
  modelo: string;
}

export interface EquipmentFilterState {
  equipment: EquipmentItem[];
  selectedIds: Set<string>;
  toggleEquipment: (id: string) => void;
  clearEquipment: () => void;
  isFiltering: boolean;
  isLoading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns equipment list from Firestore + multi-select filter state.
 *
 * selectedIds.size > 0 means filtering is active (isFiltering = true).
 * toggleEquipment adds/removes a single ID from the set.
 * clearEquipment resets to empty set (show all dashboards unfiltered).
 */
export function useEquipmentFilter(): EquipmentFilterState {
  const labId = useActiveLabId();
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!labId) {
      setEquipment([]);
      return;
    }

    setIsLoading(true);

    const col = collection(db, 'labs', labId, 'equipamentos');
    // Soft-delete filter — only active equipment (deletadoEm == null)
    const q = query(col, where('deletadoEm', '==', null));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: EquipmentItem[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name ?? data.nome ?? doc.id,
            modelo: data.modelo ?? '',
          };
        });
        // Sort by name for stable dropdown order
        items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        setEquipment(items);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[useEquipmentFilter] Firestore error:', err);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const toggleEquipment = useCallback((id: string) => {
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

  const clearEquipment = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    equipment,
    selectedIds,
    toggleEquipment,
    clearEquipment,
    isFiltering: selectedIds.size > 0,
    isLoading,
  };
}
