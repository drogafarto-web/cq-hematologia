import { useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { getDatabaseService } from '../../../shared/services/databaseService';
import type { ControlLot, StoredState, InternalStats } from '../../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Fields supplied by the operator when creating a lot. */
export type AddLotInput = Omit<
  ControlLot,
  'id' | 'labId' | 'runs' | 'statistics' | 'runCount' | 'createdAt' | 'createdBy'
>;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function applyLotUpdate(
  lots: ControlLot[],
  lotId: string,
  updater: (lot: ControlLot) => ControlLot
): ControlLot[] {
  return lots.map((l) => (l.id === lotId ? updater(l) : l));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLots — manages the lot collection for the active lab.
 *
 * Sets up the Firestore real-time subscription and exposes CRUD operations.
 * IMPORTANT: Call this hook exactly once in the component tree (e.g., in the
 * main view that owns the lot list). Child components should read from the
 * Zustand store via atomic selectors instead of calling this hook again.
 */
export function useLots() {
  const labId = useActiveLabId();
  const user  = useUser();

  // ── Zustand atoms ──────────────────────────────────────────────────────────
  const lots             = useAppStore((s) => s.lots);
  const activeLotId      = useAppStore((s) => s.activeLotId);
  const selectedAnalyteId = useAppStore((s) => s.selectedAnalyteId);
  const isLoading        = useAppStore((s) => s.isLoading);
  const syncStatus       = useAppStore((s) => s.syncStatus);
  const error            = useAppStore((s) => s.error);

  const setLots              = useAppStore((s) => s.setLots);
  const setActiveLotId       = useAppStore((s) => s.setActiveLotId);
  const setSelectedAnalyteId = useAppStore((s) => s.setSelectedAnalyteId);
  const setLoading           = useAppStore((s) => s.setLoading);
  const setSyncStatus        = useAppStore((s) => s.setSyncStatus);
  const setError             = useAppStore((s) => s.setError);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!labId) return;

    setLoading(true);

    const db  = getDatabaseService(labId);
    const unsub = db.subscribeToState((state) => {
      setLots(state.lots);
      setActiveLotId(state.activeLotId);
      setSelectedAnalyteId(state.selectedAnalyteId);
      setLoading(false);
    });

    return () => {
      unsub();
      setLoading(false);
    };
  // Actions are stable Zustand references — intentionally excluded from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  // ── Persistence helper ─────────────────────────────────────────────────────

  const persist = useCallback(
    async (state: StoredState): Promise<void> => {
      if (!labId) return;
      setSyncStatus('saving');
      try {
        await getDatabaseService(labId).saveState(state);
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        const msg = err instanceof Error ? err.message : 'Erro ao salvar dados.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [labId, setSyncStatus, setError]
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeLot = lots.find((l) => l.id === activeLotId) ?? null;

  // ── CRUD operations ───────────────────────────────────────────────────────

  /** Creates a new lot and returns its generated ID. */
  const addLot = useCallback(
    async (input: AddLotInput): Promise<string> => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');

      const newLot: ControlLot = {
        ...input,
        id:         crypto.randomUUID(),
        labId,
        runs:       [],
        statistics: null,
        runCount:   0,
        createdAt:  new Date(),
        createdBy:  user?.uid ?? '',
      };

      const newLots = [...lots, newLot];
      setLots(newLots);

      await persist({ lots: newLots, activeLotId, selectedAnalyteId });
      return newLot.id;
    },
    [labId, user, lots, activeLotId, selectedAnalyteId, setLots, persist]
  );

  /** Partially updates a lot's metadata fields. */
  const updateLot = useCallback(
    async (
      lotId: string,
      changes: Partial<Omit<ControlLot, 'id' | 'labId' | 'runs' | 'createdAt' | 'createdBy'>>
    ): Promise<void> => {
      const newLots = applyLotUpdate(lots, lotId, (lot) => ({ ...lot, ...changes }));
      setLots(newLots);
      await persist({ lots: newLots, activeLotId, selectedAnalyteId });
    },
    [lots, activeLotId, selectedAnalyteId, setLots, persist]
  );

  /**
   * Updates a lot's computed internal statistics in place.
   * Called by useRuns after confirming or deleting a run.
   */
  const updateLotStats = useCallback(
    async (lotId: string, statistics: InternalStats | null, runCount: number): Promise<void> => {
      const newLots = applyLotUpdate(lots, lotId, (lot) => ({
        ...lot,
        statistics,
        runCount,
      }));
      setLots(newLots);
      await persist({ lots: newLots, activeLotId, selectedAnalyteId });
    },
    [lots, activeLotId, selectedAnalyteId, setLots, persist]
  );

  /**
   * Deletes a lot.
   * If the deleted lot was active, activeLotId is cleared.
   */
  const deleteLot = useCallback(
    async (lotId: string): Promise<void> => {
      const newLots      = lots.filter((l) => l.id !== lotId);
      const newActiveLotId =
        activeLotId === lotId ? (newLots[0]?.id ?? null) : activeLotId;

      setLots(newLots);
      setActiveLotId(newActiveLotId);

      await persist({ lots: newLots, activeLotId: newActiveLotId, selectedAnalyteId });
    },
    [lots, activeLotId, selectedAnalyteId, setLots, setActiveLotId, persist]
  );

  /** Sets the active lot and persists the selection. */
  const selectLot = useCallback(
    async (id: string | null): Promise<void> => {
      setActiveLotId(id);
      await persist({ lots, activeLotId: id, selectedAnalyteId });
    },
    [lots, selectedAnalyteId, setActiveLotId, persist]
  );

  /** Sets the selected analyte for the chart and persists. */
  const setSelectedAnalyte = useCallback(
    async (analyteId: string | null): Promise<void> => {
      setSelectedAnalyteId(analyteId);
      await persist({ lots, activeLotId, selectedAnalyteId: analyteId });
    },
    [lots, activeLotId, setSelectedAnalyteId, persist]
  );

  return {
    // Data
    lots,
    activeLot,
    activeLotId,
    selectedAnalyteId,
    isLoading,
    syncStatus,
    error,

    // Operations
    addLot,
    updateLot,
    updateLotStats,
    deleteLot,
    selectLot,
    setSelectedAnalyte,
  } as const;
}
