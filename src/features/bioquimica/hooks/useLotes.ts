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
 * Selector: lotes in use
 */
export function useLotesEmUso(): ControlMaterial[] {
  const { lotes } = useLotes();
  return lotes.filter((l) => l.emUso === true);
}

/**
 * Selector: available lotes (not in use, not deleted, not expired)
 */
export function useLotesDisponiveis(): ControlMaterial[] {
  const { lotes } = useLotes();
  const now = new Date();

  return lotes.filter(
    (l) =>
      l.emUso !== true &&
      (!l.validade || new Date(l.validade) > now),
  );
}

/**
 * Selector: historical lotes (deleted or expired)
 */
export function useLotesHistorico(): ControlMaterial[] {
  const { lotes } = useLotes();
  const now = new Date();

  return lotes.filter(
    (l) =>
      l.deletadoEm !== null ||
      (l.validade && new Date(l.validade) <= now),
  );
}

/**
 * Get active lot for specific equipment
 */
export function useActiveLotForEquipment(equipmentId: string): ControlMaterial | null {
  const { lotes } = useLotes();

  return (
    lotes.find(
      (l) =>
        l.emUso === true &&
        l.equipmentIds?.includes(equipmentId),
    ) || null
  );
}
