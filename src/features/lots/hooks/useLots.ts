import { useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { getDatabaseService } from '../../../shared/services/databaseService';
import type { ControlLot, InternalStats, DatabaseService } from '../../../types';
import { toast } from '../../../shared/store/useToastStore';
import { haptic } from '../../../shared/hooks/useHaptic';

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
  updater: (lot: ControlLot) => ControlLot,
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
  const user = useUser();

  // ── Zustand atoms ──────────────────────────────────────────────────────────
  const lots = useAppStore((s) => s.lots);
  const activeLotId = useAppStore((s) => s.activeLotId);
  const selectedAnalyteId = useAppStore((s) => s.selectedAnalyteId);
  const isLoading = useAppStore((s) => s.isLoading);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const error = useAppStore((s) => s.error);

  const setLots = useAppStore((s) => s.setLots);
  const setActiveLotId = useAppStore((s) => s.setActiveLotId);
  const setSelectedAnalyteId = useAppStore((s) => s.setSelectedAnalyteId);
  const setLoading = useAppStore((s) => s.setLoading);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const setError = useAppStore((s) => s.setError);

  // ── Real-time subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!labId) return;

    setLoading(true);

    const db = getDatabaseService(labId);
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
  // Runs a granular write through the database service. Wraps sync-status and
  // error surfacing so callers only need to describe *what* to persist.

  const withSync = useCallback(
    async (op: (db: DatabaseService) => Promise<void>): Promise<void> => {
      if (!labId) return;
      setSyncStatus('saving');
      try {
        await op(getDatabaseService(labId));
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        const msg = err instanceof Error ? err.message : 'Erro ao salvar dados.';
        setError(msg);
        throw new Error(msg, { cause: err });
      }
    },
    [labId, setSyncStatus, setError],
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
        id: crypto.randomUUID(),
        labId,
        runs: [],
        statistics: null,
        runCount: 0,
        createdAt: new Date(),
        createdBy: user?.uid ?? '',
      };

      const prevLots = lots;
      setLots([...lots, newLot]);
      try {
        await withSync((db) => db.saveLot(newLot));
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
      haptic.confirm();
      toast.success(`Lote "${input.controlName}" adicionado.`);
      return newLot.id;
    },
    [labId, user, lots, setLots, withSync],
  );

  /** Partially updates a lot's metadata fields. */
  const updateLot = useCallback(
    async (
      lotId: string,
      changes: Partial<Omit<ControlLot, 'id' | 'labId' | 'runs' | 'createdAt' | 'createdBy'>>,
    ): Promise<void> => {
      const target = lots.find((l) => l.id === lotId);
      if (!target) return;
      const updated: ControlLot = { ...target, ...changes };
      const newLots = applyLotUpdate(lots, lotId, () => updated);
      const prevLots = lots;
      setLots(newLots);
      try {
        await withSync((db) => db.saveLot(updated));
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
    },
    [lots, setLots, withSync],
  );

  /**
   * Updates a lot's computed internal statistics in place.
   * Called by useRuns after confirming or deleting a run.
   */
  const updateLotStats = useCallback(
    async (lotId: string, statistics: InternalStats | null, runCount: number): Promise<void> => {
      const target = lots.find((l) => l.id === lotId);
      if (!target) return;
      const updated: ControlLot = { ...target, statistics, runCount };
      const newLots = applyLotUpdate(lots, lotId, () => updated);
      const prevLots = lots;
      setLots(newLots);
      try {
        await withSync((db) => db.saveLot(updated));
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
    },
    [lots, setLots, withSync],
  );

  /**
   * Deletes a lot.
   * If the deleted lot was active, activeLotId is cleared.
   */
  const deleteLot = useCallback(
    async (lotId: string): Promise<void> => {
      const newLots = lots.filter((l) => l.id !== lotId);
      const prevActiveLotId = activeLotId;
      const newActiveLotId = activeLotId === lotId ? (newLots[0]?.id ?? null) : activeLotId;

      const prevLots = lots;
      setLots(newLots);
      setActiveLotId(newActiveLotId);
      try {
        await withSync(async (db) => {
          await db.deleteLot(lotId);
          if (newActiveLotId !== prevActiveLotId) {
            await db.saveAppState({ activeLotId: newActiveLotId, selectedAnalyteId });
          }
        });
      } catch (err) {
        setLots(prevLots);
        setActiveLotId(prevActiveLotId);
        throw err;
      }
      haptic.heavy();
      toast.success('Lote excluído.');
    },
    [lots, activeLotId, selectedAnalyteId, setLots, setActiveLotId, withSync],
  );

  /** Sets the active lot and persists the selection. */
  const selectLot = useCallback(
    async (id: string | null): Promise<void> => {
      const prev = activeLotId;
      setActiveLotId(id);
      try {
        await withSync((db) => db.saveAppState({ activeLotId: id, selectedAnalyteId }));
      } catch (err) {
        setActiveLotId(prev);
        throw err;
      }
    },
    [activeLotId, selectedAnalyteId, setActiveLotId, withSync],
  );

  /** Sets the selected analyte for the chart and persists. */
  const setSelectedAnalyte = useCallback(
    async (analyteId: string | null): Promise<void> => {
      const prev = selectedAnalyteId;
      setSelectedAnalyteId(analyteId);
      try {
        await withSync((db) => db.saveAppState({ activeLotId, selectedAnalyteId: analyteId }));
      } catch (err) {
        setSelectedAnalyteId(prev);
        throw err;
      }
    },
    [activeLotId, selectedAnalyteId, setSelectedAnalyteId, withSync],
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
