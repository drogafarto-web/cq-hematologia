import {
  db,
  storage,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  firestoreErrorMessage,
} from './firebase';
import { COLLECTIONS, SUBCOLLECTIONS, STATIC_DOC_IDS } from '../../constants';
import type {
  AppStatePatch,
  DatabaseService,
  StoredState,
  ControlLot,
  Run,
  AnalyteResult,
  ManufacturerStats,
  InternalStats,
  Unsubscribe,
} from '../../types';

// ─── Serialization ────────────────────────────────────────────────────────────
// Firestore stores Date as Timestamp. We always convert at the boundary.

type FirestoreLotDoc = Omit<
  ControlLot,
  'id' | 'runs' | 'startDate' | 'expiryDate' | 'createdAt'
> & {
  startDate: Timestamp;
  expiryDate: Timestamp;
  createdAt: Timestamp;
};

type FirestoreRunDoc = Omit<Run, 'id' | 'timestamp' | 'results'> & {
  timestamp: Timestamp;
  results: FirestoreAnalyteResult[];
};

type FirestoreAnalyteResult = Omit<AnalyteResult, 'timestamp'> & {
  timestamp: Timestamp;
};

function serializeLot(lot: Omit<ControlLot, 'runs'>): FirestoreLotDoc {
  const { id: _id, startDate, expiryDate, createdAt, ...rest } = lot;
  return {
    ...rest,
    startDate: Timestamp.fromDate(startDate),
    expiryDate: Timestamp.fromDate(expiryDate),
    createdAt: Timestamp.fromDate(createdAt),
  };
}

function deserializeLot(id: string, raw: Record<string, unknown>, runs: Run[]): ControlLot {
  const d = raw as FirestoreLotDoc;
  return {
    id,
    labId: d.labId,
    lotNumber: d.lotNumber,
    controlName: d.controlName,
    equipmentName: d.equipmentName,
    serialNumber: d.serialNumber,
    level: d.level,
    requiredAnalytes: d.requiredAnalytes ?? [],
    manufacturerStats: (d.manufacturerStats ?? {}) as ManufacturerStats,
    statistics: (d.statistics ?? null) as InternalStats | null,
    runCount: d.runCount ?? 0,
    createdBy: d.createdBy,
    startDate: d.startDate.toDate(),
    expiryDate: d.expiryDate.toDate(),
    createdAt: d.createdAt.toDate(),
    runs,
  };
}

function serializeRun(run: Run): FirestoreRunDoc {
  const { id: _id, timestamp, results, sampleId, manualOverride, ...rest } = run;
  return {
    ...rest,
    // Optional fields: only include when truthy — Firestore rejects undefined values
    ...(sampleId && { sampleId }),
    ...(manualOverride && { manualOverride }),
    timestamp: Timestamp.fromDate(timestamp),
    results: results.map((r) => ({
      ...r,
      timestamp: Timestamp.fromDate(r.timestamp),
      violations: r.violations ?? [],
    })),
  };
}

function deserializeRun(id: string, raw: Record<string, unknown>): Run {
  const d = raw as FirestoreRunDoc;
  return {
    id,
    lotId: d.lotId,
    labId: d.labId,
    imageUrl: d.imageUrl,
    status: d.status,
    createdBy: d.createdBy,
    // Optional fields: only include when present to avoid undefined in memory
    ...(d.sampleId && { sampleId: d.sampleId }),
    ...(d.manualOverride && { manualOverride: d.manualOverride }),
    timestamp: d.timestamp.toDate(),
    results: d.results.map((r) => ({
      ...r,
      timestamp:
        r.timestamp instanceof Timestamp
          ? r.timestamp.toDate()
          : new Date(r.timestamp as unknown as string),
      violations: r.violations ?? [],
    })) as AnalyteResult[],
  };
}

// ─── Batched write helper ─────────────────────────────────────────────────────
// Firestore batches are capped at 500 ops. We chunk to stay safe.

type WriteBatch = ReturnType<typeof writeBatch>;
type BatchOp = (b: WriteBatch) => void;

async function runBatched(ops: BatchOp[], chunkSize = 450): Promise<void> {
  if (ops.length === 0) return;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const b = writeBatch(db);
    ops.slice(i, i + chunkSize).forEach((op) => op(b));
    await b.commit();
  }
}

// ─── FirebaseService ──────────────────────────────────────────────────────────

export class FirebaseService implements DatabaseService {
  private readonly labId: string;

  // In-memory ID tracking for diff-based saves.
  // Avoids loading the full Firestore state on every saveState call.
  private knownLotIds: Set<string> | null = null;
  private knownRunIds: Map<string, Set<string>> | null = null; // lotId → runIds

  constructor(labId: string) {
    this.labId = labId;
  }

  // ── Firestore path helpers ─────────────────────────────────────────────────

  private appStateRef() {
    return doc(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.DATA, STATIC_DOC_IDS.APP_STATE);
  }

  private lotsCol() {
    return collection(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.LOTS);
  }

  private lotRef(lotId: string) {
    return doc(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.LOTS, lotId);
  }

  private runsCol(lotId: string) {
    return collection(
      db,
      COLLECTIONS.LABS,
      this.labId,
      SUBCOLLECTIONS.LOTS,
      lotId,
      SUBCOLLECTIONS.RUNS,
    );
  }

  private runRef(lotId: string, runId: string) {
    return doc(
      db,
      COLLECTIONS.LABS,
      this.labId,
      SUBCOLLECTIONS.LOTS,
      lotId,
      SUBCOLLECTIONS.RUNS,
      runId,
    );
  }

  // ── ID tracking bootstrap (one-time read on first saveState) ──────────────

  private async ensureTracking(): Promise<void> {
    if (this.knownLotIds !== null) return;

    const lotsSnap = await getDocs(this.lotsCol());
    this.knownLotIds = new Set(lotsSnap.docs.map((d) => d.id));
    this.knownRunIds = new Map();

    await Promise.all(
      lotsSnap.docs.map(async (lotDoc) => {
        const runsSnap = await getDocs(this.runsCol(lotDoc.id));
        this.knownRunIds!.set(lotDoc.id, new Set(runsSnap.docs.map((d) => d.id)));
      }),
    );
  }

  // ── saveState ──────────────────────────────────────────────────────────────
  // Full diff sync: upserts new/updated docs, deletes removed ones.

  async saveState(state: StoredState): Promise<void> {
    try {
      await this.ensureTracking();

      const { lots, activeLotId, selectedAnalyteId } = state;
      const incomingLotIds = new Set(lots.map((l) => l.id));

      // 1. Delete lots that are no longer in state (including their runs)
      const removedLotIds = [...this.knownLotIds!].filter((id) => !incomingLotIds.has(id));

      for (const lotId of removedLotIds) {
        const runIds = this.knownRunIds!.get(lotId) ?? new Set<string>();
        await runBatched([
          ...[...runIds].map(
            (runId): BatchOp =>
              (b) =>
                b.delete(this.runRef(lotId, runId)),
          ),
          (b) => b.delete(this.lotRef(lotId)),
        ]);
        this.knownLotIds!.delete(lotId);
        this.knownRunIds!.delete(lotId);
      }

      // 2. Upsert appState + all lot documents (without runs array)
      await runBatched([
        (b) =>
          b.set(this.appStateRef(), {
            activeLotId,
            selectedAnalyteId,
            lastUpdated: serverTimestamp(),
          }),
        ...lots.map((lot): BatchOp => {
          const { runs: _runs, ...lotWithoutRuns } = lot;
          return (b) => b.set(this.lotRef(lot.id), serializeLot(lotWithoutRuns));
        }),
      ]);

      lots.forEach((lot) => this.knownLotIds!.add(lot.id));

      // 3. Sync runs per lot (diff deletions + upserts)
      for (const lot of lots) {
        const incomingRunIds = new Set(lot.runs.map((r) => r.id));
        const existingRunIds = this.knownRunIds!.get(lot.id) ?? new Set<string>();

        const removedRunIds = [...existingRunIds].filter((id) => !incomingRunIds.has(id));

        await runBatched([
          ...removedRunIds.map(
            (id): BatchOp =>
              (b) =>
                b.delete(this.runRef(lot.id, id)),
          ),
          ...lot.runs.map(
            (run): BatchOp =>
              (b) =>
                b.set(this.runRef(lot.id, run.id), serializeRun(run)),
          ),
        ]);

        this.knownRunIds!.set(lot.id, incomingRunIds);
      }
    } catch (err) {
      console.error('[FirebaseService] saveState error:', err);
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  // ── loadState ──────────────────────────────────────────────────────────────

  async loadState(): Promise<StoredState | null> {
    try {
      const [appStateSnap, lotsSnap] = await Promise.all([
        getDoc(this.appStateRef()),
        getDocs(this.lotsCol()),
      ]);

      if (!appStateSnap.exists() && lotsSnap.empty) return null;

      const lots = await Promise.all(
        lotsSnap.docs.map(async (lotDoc) => {
          const runsSnap = await getDocs(this.runsCol(lotDoc.id));
          const runs = runsSnap.docs.map((d) =>
            deserializeRun(d.id, d.data() as Record<string, unknown>),
          );
          return deserializeLot(lotDoc.id, lotDoc.data() as Record<string, unknown>, runs);
        }),
      );

      const appData = appStateSnap.exists() ? appStateSnap.data() : {};

      return {
        lots,
        activeLotId: (appData.activeLotId as string | null) ?? null,
        selectedAnalyteId: (appData.selectedAnalyteId as string | null) ?? null,
      };
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  // ── subscribeToState ───────────────────────────────────────────────────────
  // Three-layer listener: appState → lots → runs per lot.
  // Emits only after all three layers have delivered their first snapshot,
  // preventing a flash of empty state on initial load.

  subscribeToState(callback: (state: StoredState) => void): Unsubscribe {
    let appStateData = {
      activeLotId: null as string | null,
      selectedAnalyteId: null as string | null,
    };

    // lotsMap holds the current merged view: lot metadata + its runs
    const lotsMap = new Map<string, { meta: Omit<ControlLot, 'runs'>; runs: Run[] }>();
    const runUnsubbers = new Map<string, () => void>();

    // Guards — ensure we only emit after all layers are ready
    let appStateReady = false;
    let lotsReady = false;
    // Track lot IDs whose runs haven't delivered a first snapshot yet
    const pendingRunInit = new Set<string>();

    const emit = () => {
      if (!appStateReady || !lotsReady || pendingRunInit.size > 0) return;

      const lots: ControlLot[] = Array.from(lotsMap.values()).map(({ meta, runs }) => ({
        ...meta,
        runs,
      }));

      callback({ lots, ...appStateData });
    };

    // Layer 1: appState
    const appStateUnsub = onSnapshot(
      this.appStateRef(),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        appStateData = {
          activeLotId: (d.activeLotId as string | null) ?? null,
          selectedAnalyteId: (d.selectedAnalyteId as string | null) ?? null,
        };
        appStateReady = true;
        emit();
      },
      (err) => console.error('[FirebaseService] appState listener error:', err),
    );

    // Layer 2: lots collection
    const lotsUnsub = onSnapshot(
      this.lotsCol(),
      (snap) => {
        for (const change of snap.docChanges()) {
          const lotId = change.doc.id;

          if (change.type === 'removed') {
            lotsMap.delete(lotId);
            pendingRunInit.delete(lotId);
            runUnsubbers.get(lotId)?.();
            runUnsubbers.delete(lotId);
            continue;
          }

          // Add or modify: update metadata, preserve existing runs
          const existing = lotsMap.get(lotId);
          const fullLot = deserializeLot(lotId, change.doc.data() as Record<string, unknown>, []);
          const { runs: _runs, ...meta } = fullLot;

          lotsMap.set(lotId, { meta, runs: existing?.runs ?? [] });

          // Layer 3: subscribe to runs for each lot (once)
          if (!runUnsubbers.has(lotId)) {
            pendingRunInit.add(lotId);

            const runUnsub = onSnapshot(
              this.runsCol(lotId),
              (runsSnap) => {
                const runs = runsSnap.docs.map((d) =>
                  deserializeRun(d.id, d.data() as Record<string, unknown>),
                );
                const entry = lotsMap.get(lotId);
                if (entry) lotsMap.set(lotId, { ...entry, runs });

                pendingRunInit.delete(lotId); // first snapshot received
                emit();
              },
              (err) => console.error(`[FirebaseService] runs[${lotId}] listener error:`, err),
            );

            runUnsubbers.set(lotId, runUnsub);
          }
        }

        lotsReady = true;
        emit();
      },
      (err) => console.error('[FirebaseService] lots listener error:', err),
    );

    return () => {
      appStateUnsub();
      lotsUnsub();
      runUnsubbers.forEach((unsub) => unsub());
      runUnsubbers.clear();
    };
  }

  // ── uploadFile ─────────────────────────────────────────────────────────────

  async uploadFile(file: File, path: string): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      return await getDownloadURL(storageRef);
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : 'Falha no upload do arquivo. Tente novamente.',
        { cause: err },
      );
    }
  }

  // ── Granular writes ────────────────────────────────────────────────────────
  // Touch only the document the caller intends to change. This keeps selectLot
  // / setSelectedAnalyte inside the appState rule (writable by any member) and
  // prevents the admin-only lots/{lotId} rule from bouncing member actions.

  async saveAppState(patch: AppStatePatch): Promise<void> {
    try {
      await setDoc(
        this.appStateRef(),
        { ...patch, lastUpdated: serverTimestamp() },
        { merge: true },
      );
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async saveLot(lot: ControlLot): Promise<void> {
    try {
      const { runs: _runs, ...lotWithoutRuns } = lot;
      await setDoc(this.lotRef(lot.id), serializeLot(lotWithoutRuns));
      if (this.knownLotIds) this.knownLotIds.add(lot.id);
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async deleteLot(lotId: string): Promise<void> {
    try {
      await this.ensureTracking();
      const runIds = this.knownRunIds!.get(lotId) ?? new Set<string>();
      await runBatched([
        ...[...runIds].map(
          (runId): BatchOp =>
            (b) =>
              b.delete(this.runRef(lotId, runId)),
        ),
        (b) => b.delete(this.lotRef(lotId)),
      ]);
      this.knownLotIds!.delete(lotId);
      this.knownRunIds!.delete(lotId);
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async saveRun(lotId: string, run: Run): Promise<void> {
    try {
      await setDoc(this.runRef(lotId, run.id), serializeRun(run));
      if (this.knownRunIds) {
        const set = this.knownRunIds.get(lotId) ?? new Set<string>();
        set.add(run.id);
        this.knownRunIds.set(lotId, set);
      }
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async deleteRun(lotId: string, runId: string): Promise<void> {
    try {
      await runBatched([(b) => b.delete(this.runRef(lotId, runId))]);
      this.knownRunIds?.get(lotId)?.delete(runId);
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }
}
