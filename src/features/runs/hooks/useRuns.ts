import { useState, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { getDatabaseService } from '../../../shared/services/databaseService';
import { extractDataFromImage } from '../services/geminiService';
import { checkWestgardRules, isRejection } from '../../chart/utils/westgardRules';
import { storagePath, MIN_RUNS_FOR_INTERNAL_STATS, SUPPORTED_IMAGE_TYPES, IMAGE_UPLOAD_MAX_SIZE_BYTES } from '../../../constants';
import { ANALYTE_MAP } from '../../../constants';
import { toast } from '../../../shared/store/useToastStore';
import { haptic } from '../../../shared/hooks/useHaptic';
import type {
  Run,
  ControlLot,
  AnalyteResult,
  RunStatus,
  InternalStats,
  AnalyteStats,
  WestgardViolation,
  DatabaseService,
} from '../../../types';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Converts a File to base64 string (no data URI prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Strip "data:image/...;base64," prefix
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

/** Returns the stat to use for a given analyte: internal first, manufacturer as fallback. */
function resolveStats(lot: ControlLot, analyteId: string): AnalyteStats | null {
  return lot.statistics?.[analyteId] ?? lot.manufacturerStats[analyteId] ?? null;
}

/**
 * Calculates internal statistics from the lot's approved runs.
 *
 * Uses Bessel-corrected sample SD (N-1 denominator, ISO 5725 / CLSI EP05).
 * Requires ≥ 2 approved values per analyte — fewer than 2 yields undefined SD.
 * Returns null when no analyte meets the minimum.
 */
function calculateInternalStats(lot: ControlLot): InternalStats | null {
  const approved = lot.runs.filter((r) => r.status === 'Aprovada');
  if (approved.length < 2) return null;

  const stats: InternalStats = {};

  for (const analyteId of lot.requiredAnalytes) {
    const values = approved
      .flatMap((r) => r.results.filter((res) => res.analyteId === analyteId))
      .map((res) => res.value);

    if (values.length < 2) continue;

    const n        = values.length;
    const mean     = values.reduce((a, b) => a + b, 0) / n;
    // Sample variance (N-1): unbiased estimator of population variance
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
    stats[analyteId] = { mean, sd: Math.sqrt(variance) };
  }

  return Object.keys(stats).length > 0 ? stats : null;
}

/**
 * Builds AnalyteResult[] for a new run, applying Westgard rules against the
 * lot's existing run history.
 *
 * @param rawResults   AI-extracted (or operator-edited) values, keyed by analyteId
 * @param runId        ID of the run being created
 * @param lot          Active lot (source of previous runs and stats)
 * @param now          Timestamp for all results
 */
function buildAnalyteResults(
  rawResults: Record<string, { value: number; confidence: number; reasoning: string }>,
  runId: string,
  lot: ControlLot,
  now: Date
): AnalyteResult[] {
  // Existing runs sorted newest → oldest for Westgard lookback
  const sortedRuns = [...lot.runs].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  return Object.entries(rawResults).map(([analyteId, raw]) => {
    const stats = resolveStats(lot, analyteId);

    let violations: WestgardViolation[] = [];
    if (stats) {
      const previousValues = sortedRuns
        .map((r) => r.results.find((res) => res.analyteId === analyteId)?.value)
        .filter((v): v is number => v !== undefined);

      violations = checkWestgardRules(raw.value, previousValues, stats);
    }

    return {
      id:         crypto.randomUUID(),
      runId,
      analyteId,
      value:      raw.value,
      confidence: raw.confidence,
      reasoning:  raw.reasoning,
      timestamp:  now,
      violations,
    } satisfies AnalyteResult;
  });
}


/** Immutably updates a single run inside the lots array. */
function updateRunInLots(
  lots: ControlLot[],
  lotId: string,
  runId: string,
  updater: (run: Run) => Run
): ControlLot[] {
  return lots.map((lot) => {
    if (lot.id !== lotId) return lot;
    return {
      ...lot,
      runs: lot.runs.map((r) => (r.id === runId ? updater(r) : r)),
    };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useRuns — manages the full run lifecycle for the active lot.
 *
 * Flow:
 *   newRun(file) → pendingRun is set in store
 *   confirmRun() → creates Run, saves data, uploads image in background
 *   cancelRun()  → clears pendingRun
 *   updateRun()  → operator overrides (status, sampleId)
 *   deleteRun()  → removes run, recalculates stats
 */
export function useRuns() {
  const labId = useActiveLabId();
  const user  = useUser();

  // ── Zustand atoms ──────────────────────────────────────────────────────────
  const lots            = useAppStore((s) => s.lots);
  const activeLotId     = useAppStore((s) => s.activeLotId);
  const pendingRun      = useAppStore((s) => s.pendingRun);

  const setLots       = useAppStore((s) => s.setLots);
  const setPendingRun = useAppStore((s) => s.setPendingRun);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const setError      = useAppStore((s) => s.setError);

  // ── Local loading states (not global — scoped to run actions) ──────────────
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [runError, setRunError]         = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const activeLot = lots.find((l) => l.id === activeLotId) ?? null;

  // Granular-write wrapper: surfaces sync status without forcing callers to
  // rebuild a whole StoredState envelope (which would tempt us back into the
  // full-sync pattern that caused the original permission-denied regressions).
  const withSync = useCallback(
    async (op: (db: DatabaseService) => Promise<void>): Promise<void> => {
      if (!labId) return;
      setSyncStatus('saving');
      try {
        await op(getDatabaseService(labId));
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('error');
        throw err;
      }
    },
    [labId, setSyncStatus]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Validates the file, calls Gemini OCR, and stores the result as a pending run.
   * Does NOT save anything to Firestore.
   */
  const newRun = useCallback(
    async (file: File): Promise<void> => {
      if (!activeLot) {
        setRunError('Nenhum lote ativo. Selecione um lote antes de registrar uma corrida.');
        return;
      }

      // File validation
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as typeof SUPPORTED_IMAGE_TYPES[number])) {
        setRunError(`Tipo de arquivo não suportado. Use: ${SUPPORTED_IMAGE_TYPES.join(', ')}`);
        return;
      }
      if (file.size > IMAGE_UPLOAD_MAX_SIZE_BYTES) {
        setRunError('Arquivo muito grande. O limite é 10 MB.');
        return;
      }

      setRunError(null);
      setIsExtracting(true);

      try {
        const base64   = await fileToBase64(file);
        const analytes = activeLot.requiredAnalytes
          .map((id) => ANALYTE_MAP[id])
          .filter(Boolean);

        const extraction = await extractDataFromImage(base64, analytes, file.type);

        setPendingRun({
          file,
          base64,
          mimeType:  file.type,
          sampleId:  extraction.sampleId,
          results:   extraction.results,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido na extração.';
        setRunError(msg);
      } finally {
        setIsExtracting(false);
      }
    },
    [activeLot, setPendingRun]
  );

  /**
   * Confirms the pending run:
   * 1. Creates the Run document (with empty imageUrl)
   * 2. Updates the lot in the store + persists
   * 3. Clears pendingRun (unblocks UI)
   * 4. Uploads image in background and updates imageUrl
   */
  const confirmRun = useCallback(
    async (editedValues: Record<string, number>, approve: boolean): Promise<void> => {
      if (!pendingRun)  { setRunError('Nenhuma corrida pendente.');      return; }
      if (!activeLot)   { setRunError('Nenhum lote ativo.');             return; }
      if (!labId)       { setRunError('Nenhum laboratório ativo.');      return; }

      setRunError(null);
      setIsConfirming(true);

      const runId = crypto.randomUUID();
      const now   = new Date();

      try {
        // Merge operator edits into the AI results before building
        const mergedResults = Object.fromEntries(
          Object.entries(pendingRun.results).map(([id, r]) => [
            id,
            id in editedValues && !Number.isNaN(editedValues[id])
              ? { ...r, value: editedValues[id] }
              : r,
          ]),
        );

        // Build results with Westgard violations (informational — operator decides status)
        const results  = buildAnalyteResults(mergedResults, runId, activeLot, now);
        const status: RunStatus = approve ? 'Aprovada' : 'Rejeitada';
        // manualOverride = true when operator explicitly approved despite rejection-level violations
        const hasRejectionViolation = results.some((r) => isRejection(r.violations));

        const newRun: Run = {
          id:             runId,
          lotId:          activeLot.id,
          labId,
          ...(pendingRun.sampleId && { sampleId: pendingRun.sampleId }),
          timestamp:      now,
          imageUrl:       '', // Filled in by background upload below
          status,
          results,
          ...(approve && hasRejectionViolation && { manualOverride: true }),
          createdBy:      user?.uid ?? '',
        };

        // Update lot: add run, increment runCount, recalculate stats
        const lotWithNewRun: ControlLot = {
          ...activeLot,
          runs:       [...activeLot.runs, newRun],
          runCount:   activeLot.runCount + 1,
          statistics: null, // recalculated below
        };
        lotWithNewRun.statistics = calculateInternalStats(lotWithNewRun);

        const newLots = lots.map((l) => (l.id === activeLot.id ? lotWithNewRun : l));

        // Optimistic update + persist (without image URL).
        // Snapshot pre-update lots so we can roll back on persist failure.
        const prevLots = lots;
        setLots(newLots);
        try {
          await withSync(async (db) => {
            await db.saveRun(activeLot.id, newRun);
            // Persist the lot's updated stats + runCount (metadata only — runs
            // aren't duplicated here because saveLot drops the runs array).
            await db.saveLot(lotWithNewRun);
          });
        } catch (err) {
          // Rollback — prevent ghost runs from accumulating in the store
          setLots(prevLots);
          throw err;
        }

        // Unblock the UI — image upload happens in the background
        setPendingRun(null);

        // Feedback: haptic + toast reflecting the operator's decision
        if (approve) {
          haptic.confirm();
          toast.success('Corrida aprovada e registrada.');
        } else {
          haptic.confirm();
          toast.info('Corrida rejeitada e registrada.');
        }

        // Background image upload — non-blocking
        void (async () => {
          try {
            const path = storagePath.runImage(labId, activeLot.id, runId);
            const url  = await getDatabaseService(labId).uploadFile(pendingRun.file, path);

            const current = useAppStore.getState();
            const updated = updateRunInLots(current.lots, activeLot.id, runId, (r) => ({
              ...r,
              imageUrl: url,
            }));

            setLots(updated);
            const runWithImage: Run = { ...newRun, imageUrl: url };
            await withSync((db) => db.saveRun(activeLot.id, runWithImage));
          } catch (err) {
            console.error('[useRuns] Background image upload failed:', err);
            // Non-fatal: run data is already saved; image URL will be empty
          }
        })();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao confirmar corrida.';
        setRunError(msg);
        setError(msg);
        haptic.error();
        toast.error(msg);
      } finally {
        setIsConfirming(false);
      }
    },
    [pendingRun, activeLot, labId, user, lots, setLots, setPendingRun, setError, withSync]
  );

  /** Discards the current pending run without saving. */
  const cancelRun = useCallback(() => {
    setPendingRun(null);
    setRunError(null);
  }, [setPendingRun]);

  /**
   * Updates mutable fields of an existing run.
   * If status changes, recalculates internal statistics for the lot.
   */
  const updateRun = useCallback(
    async (
      lotId: string,
      runId: string,
      changes: Partial<Pick<Run, 'status' | 'manualOverride' | 'sampleId'>>
    ): Promise<void> => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) return;

      const targetRun = lot.runs.find((r) => r.id === runId);
      if (!targetRun) return;
      const updatedRun: Run = { ...targetRun, ...changes };

      let newLots = updateRunInLots(lots, lotId, runId, () => updatedRun);

      // Recalculate stats only when status changed — approved run count may differ
      const statusChanged = 'status' in changes;
      let updatedLot = newLots.find((l) => l.id === lotId)!;
      if (statusChanged) {
        const newStats = calculateInternalStats(updatedLot);
        updatedLot = { ...updatedLot, statistics: newStats };
        newLots = newLots.map((l) => (l.id === lotId ? updatedLot : l));
      }

      const prevLots = lots;
      setLots(newLots);
      try {
        await withSync(async (db) => {
          await db.saveRun(lotId, updatedRun);
          if (statusChanged) await db.saveLot(updatedLot);
        });
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
    },
    [lots, setLots, withSync]
  );

  /**
   * Deletes a run from its lot, updates runCount and recalculates statistics.
   */
  const deleteRun = useCallback(
    async (lotId: string, runId: string): Promise<void> => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) return;

      const filteredRuns = lot.runs.filter((r) => r.id !== runId);
      const updatedLot: ControlLot = {
        ...lot,
        runs:       filteredRuns,
        runCount:   filteredRuns.length,
        statistics: calculateInternalStats({ ...lot, runs: filteredRuns }),
      };

      const newLots = lots.map((l) => (l.id === lotId ? updatedLot : l));
      const prevLots = lots;
      setLots(newLots);
      try {
        await withSync(async (db) => {
          await db.deleteRun(lotId, runId);
          await db.saveLot(updatedLot);
        });
      } catch (err) {
        setLots(prevLots);
        throw err;
      }
      haptic.heavy();
      toast.success('Corrida excluída.');
    },
    [lots, setLots, withSync]
  );

  return {
    // State
    pendingRun,
    isExtracting,
    isConfirming,
    error: runError,

    // Actions
    newRun,
    confirmRun,
    cancelRun,
    updateRun,
    deleteRun,
  } as const;
}
