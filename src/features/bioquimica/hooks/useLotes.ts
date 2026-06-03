/**
 * useLotes — real-time subscription to bioquímica control material
 *
 * Filters:
 * - Non-deleted: deletadoEm == null
 * - By lab: derived from useActiveLabId()
 */

import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeLotes } from '../services/lotService';
import type { ControlMaterial } from '../types';

export function useLotes() {
  const labId = useActiveLabId();
  const [lotes, setLotes] = useState<ControlMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!labId) {
      setLotes([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeLotes(labId, (newLotes) => {
      setLotes(newLotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [labId]);

  return { lotes, loading };
}

/**
 * Selector: active lotes (not deleted, not expired, not archived)
 */
export function useLotesEmUso(): ControlMaterial[] {
  const { lotes } = useLotes();
  const now = new Date();

  return lotes.filter(
    (l) =>
      l.deletadoEm === null &&
      !l.archivedAt &&
      l.validade &&
      (l.validade instanceof Date ? l.validade : l.validade.toDate?.()) > now,
  );
}

/**
 * Selector: archived or expired lotes
 */
export function useLotesDisponiveis(): ControlMaterial[] {
  const { lotes } = useLotes();
  return lotes.filter((l) => l.deletadoEm === null && !l.archivedAt);
}

/**
 * Selector: historical lotes (deleted or archived or expired)
 */
export function useLotesHistorico(): ControlMaterial[] {
  const { lotes } = useLotes();
  const now = new Date();

  return lotes.filter((l) => l.deletadoEm !== null || l.archivedAt !== undefined);
}

/**
 * Get first available lot for specific equipment
 */
export function useActiveLotForEquipment(equipmentId: string): ControlMaterial | null {
  const { lotes } = useLotes();
  const now = new Date();

  return (
    lotes.find(
      (l) =>
        l.deletadoEm === null &&
        !l.archivedAt &&
        l.equipmentIds?.includes(equipmentId) &&
        l.validade &&
        (l.validade instanceof Date ? l.validade : l.validade.toDate?.()) > now,
    ) || null
  );
}
