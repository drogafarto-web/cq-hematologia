import { useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { getDatabaseService } from '../../../shared/services/databaseService';
import { checkWestgardRules, isRejection } from '../../chart/utils/westgardRules';
import type {
  ControlLot,
  InternalStats,
  DatabaseService,
  ManufacturerStats,
  Run,
} from '../../../types';
import { toast } from '../../../shared/store/useToastStore';
import { haptic } from '../../../shared/hooks/useHaptic';
import { trackEvent, Sentry } from '../../../lib/sentry';

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

      // Chave natural: lotNumber+level+controlName. Bloqueia re-import da
      // mesma bula Controllab — duplicatas com IDs distintos bagunçam picker
      // de níveis e cálculo de estatística interna.
      const dup = lots.find(
        (l) =>
          l.lotNumber === input.lotNumber &&
          l.level === input.level &&
          l.controlName === input.controlName,
      );
      if (dup) {
        const dt = dup.startDate.toLocaleDateString('pt-BR');
        throw new Error(
          `Lote "${input.lotNumber}" NV${input.level} já cadastrado em ${dt}. ` +
            `Verifique a aba "Lotes de controle" antes de re-importar a bula.`,
        );
      }

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
        // saveLot replica em /insumos internamente — ver firebaseService.
        await withSync((db) => db.saveLot(newLot));
      } catch (err) {
        setLots(prevLots);
        throw err;
      }

      const olderSameControl = lots.filter(
        (l) =>
          l.controlName === input.controlName && !l.archivedAt && l.startDate < input.startDate,
      );
      if (olderSameControl.length > 0) {
        const ids = olderSameControl.map((l) => l.id);
        const now = new Date();
        setLots(
          lots.map((l) => (ids.includes(l.id) ? { ...l, archivedAt: now } : l)).concat(newLot),
        );
        try {
          await withSync(async (db) => {
            for (const old of olderSameControl) {
              await db.saveLot({ ...old, archivedAt: now });
            }
          });
        } catch {
          // não-bloqueante: lote novo já foi criado com sucesso
        }
        toast.info(
          `${olderSameControl.length} lote${olderSameControl.length === 1 ? '' : 's'} anterior${olderSameControl.length === 1 ? '' : 'es'} arquivado${olderSameControl.length === 1 ? '' : 's'}.`,
        );
      }

      haptic.confirm();
      toast.success(`Lote "${input.controlName}" adicionado.`);
      return newLot.id;
    },
    [labId, user, lots, setLots, withSync],
  );

  const archiveLots = useCallback(
    async (lotIds: string[]): Promise<void> => {
      if (!lotIds.length) return;
      const now = new Date();
      const toArchive = lotIds
        .map((id) => lots.find((l) => l.id === id))
        .filter((l): l is ControlLot => !!l && !l.archivedAt);
      if (!toArchive.length) return;

      const prevLots = lots;
      setLots(
        lots.map((l) => (toArchive.some((a) => a.id === l.id) ? { ...l, archivedAt: now } : l)),
      );
      try {
        await withSync(async (db) => {
          for (const lot of toArchive) {
            await db.saveLot({ ...lot, archivedAt: now });
          }
        });
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
    },
    [lots, setLots, withSync],
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

  /**
   * Sets the active lot and persists the selection.
   *
   * Auto-rebind do analito: bulas Controllab variam analitos por nível (ex:
   * Yumizen H550 NV1 não fornece MCH/PCT — DP não aplicável). Sem rebind,
   * trocar de NV2 (com MCH selecionado) pra NV1 deixa `validAnalyteId` null
   * e o gráfico fica vazio sem feedback ao operador.
   */
  const selectLot = useCallback(
    async (id: string | null): Promise<void> => {
      const prevLot = activeLotId;
      const prevAnalyte = selectedAnalyteId;

      const target = id ? (lots.find((l) => l.id === id) ?? null) : null;
      const nextAnalyte =
        target && selectedAnalyteId && !target.requiredAnalytes.includes(selectedAnalyteId)
          ? (target.requiredAnalytes[0] ?? null)
          : selectedAnalyteId;

      setActiveLotId(id);
      if (nextAnalyte !== prevAnalyte) setSelectedAnalyteId(nextAnalyte);
      try {
        await withSync((db) =>
          db.saveAppState({ activeLotId: id, selectedAnalyteId: nextAnalyte }),
        );
      } catch (err) {
        setActiveLotId(prevLot);
        if (nextAnalyte !== prevAnalyte) setSelectedAnalyteId(prevAnalyte);
        throw err;
      }
    },
    [activeLotId, selectedAnalyteId, lots, setActiveLotId, setSelectedAnalyteId, withSync],
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

  /**
   * Aplica a bula a um lote pendente: preenche `manufacturerStats`,
   * `requiredAnalytes`, zera `bulaPendente` e RECOMPUTA Westgard de todas
   * as runs já gravadas nesse lote (que estavam sem limites). Cada run
   * recebe `recalculatedAt` pra trilha auditável.
   *
   * O recálculo segue ordem cronológica (timestamp asc) — Westgard usa
   * histórico de pontos anteriores. Status final de cada run:
   *   - violation rejection presente → 'Rejeitada'
   *   - else (warnings ou nenhuma) → 'Aprovada'
   */
  const applyBulaToLot = useCallback(
    async (
      lotId: string,
      manufacturerStats: ManufacturerStats,
      requiredAnalytes: string[],
    ): Promise<void> => {
      if (!labId) throw new Error('Nenhum laboratório ativo.');
      const target = lots.find((l) => l.id === lotId);
      if (!target) throw new Error(`Lote ${lotId} não encontrado.`);

      trackEvent('bula', 'applyBulaToLot', {
        lotId,
        lotNumber: target.lotNumber,
        level: target.level,
        runsToRecalculate: target.runs.length,
        analytesInBula: Object.keys(manufacturerStats).length,
      });

      // 1) Atualiza metadata do lote
      const updatedLot: ControlLot = {
        ...target,
        manufacturerStats,
        requiredAnalytes,
        bulaPendente: false,
      };

      // 2) Recalcula Westgard das runs em ordem cronológica
      const runsAsc = [...target.runs].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );
      const now = new Date();
      const recalculatedRuns: Run[] = [];
      const previousByAnalyte = new Map<string, number[]>();
      for (const run of runsAsc) {
        const newResults = run.results.map((res) => {
          const stats = manufacturerStats[res.analyteId];
          if (!stats) {
            // Analito sem stats na bula — preserva resultado bruto, sem violations.
            return { ...res, violations: [] };
          }
          const previous = previousByAnalyte.get(res.analyteId) ?? [];
          const violations = checkWestgardRules(res.value, previous, stats);
          // Atualiza histórico do analito pra próxima iteração.
          previousByAnalyte.set(res.analyteId, [res.value, ...previous]);
          return { ...res, violations };
        });
        const hasReject = newResults.some((r) => isRejection(r.violations ?? []));
        recalculatedRuns.push({
          ...run,
          results: newResults,
          status: hasReject ? 'Rejeitada' : 'Aprovada',
          recalculatedAt: now,
        });
      }

      // 3) Aplica em ordem original (mantém ordem do array de runs in-memory)
      const recalcMap = new Map(recalculatedRuns.map((r) => [r.id, r]));
      const newRuns = target.runs.map((r) => recalcMap.get(r.id) ?? r);
      const finalLot: ControlLot = { ...updatedLot, runs: newRuns };

      // 4) Persiste — saveLot atualiza metadata; saveRun por run individual
      const prevLots = lots;
      setLots(applyLotUpdate(lots, lotId, () => finalLot));
      try {
        await withSync(async (db) => {
          await db.saveLot(finalLot);
          for (const run of newRuns) {
            await db.saveRun(lotId, run);
          }
        });
      } catch (err) {
        setLots(prevLots);
        Sentry.captureException(err, {
          tags: { feature: 'bula', action: 'applyBulaToLot' },
          extra: { lotId, runsCount: newRuns.length },
        });
        throw err;
      }

      haptic.confirm();
      toast.success(
        `Bula aplicada — ${newRuns.length} corrida${newRuns.length === 1 ? '' : 's'} recalculada${newRuns.length === 1 ? '' : 's'}.`,
      );
    },
    [labId, lots, setLots, withSync],
  );

  /**
   * Toggle do override manual de "em uso". Quando ativado, o lote sai da
   * seção EM USO mesmo sendo da bula corrente — usado em casos operacionais
   * (lote contaminado, retido, etc). Reversível chamando de novo.
   */
  const toggleManualHidden = useCallback(
    async (lotId: string): Promise<void> => {
      const target = lots.find((l) => l.id === lotId);
      if (!target) return;
      await updateLot(lotId, { manualHidden: !target.manualHidden });
    },
    [lots, updateLot],
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
    toggleManualHidden,
    applyBulaToLot,
    archiveLots,
  } as const;
}
