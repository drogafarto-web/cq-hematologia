import type {
  AppStatePatch,
  DatabaseService,
  StoredState,
  ControlLot,
  Run,
  AnalyteResult,
  Unsubscribe,
} from '../../types';

// ─── Persistence format ───────────────────────────────────────────────────────
// Dates are stored as ISO strings because JSON.stringify loses Date objects.

const SCHEMA_VERSION = 1;

interface PersistedState {
  v: number;
  activeLotId: string | null;
  selectedAnalyteId: string | null;
  lots: SerializedLot[];
}

type SerializedLot = Omit<ControlLot, 'startDate' | 'expiryDate' | 'createdAt' | 'runs'> & {
  startDate: string;
  expiryDate: string;
  createdAt: string;
  runs: SerializedRun[];
};

type SerializedRun = Omit<Run, 'timestamp' | 'results'> & {
  timestamp: string;
  results: SerializedAnalyteResult[];
};

type SerializedAnalyteResult = Omit<AnalyteResult, 'timestamp'> & {
  timestamp: string;
};

// ─── Serialization helpers ────────────────────────────────────────────────────

function serializeLot(lot: ControlLot): SerializedLot {
  return {
    ...lot,
    startDate:  lot.startDate.toISOString(),
    expiryDate: lot.expiryDate.toISOString(),
    createdAt:  lot.createdAt.toISOString(),
    runs: lot.runs.map(serializeRun),
  };
}

function deserializeLot(s: SerializedLot): ControlLot {
  return {
    ...s,
    startDate:  new Date(s.startDate),
    expiryDate: new Date(s.expiryDate),
    createdAt:  new Date(s.createdAt),
    runs: s.runs.map(deserializeRun),
  };
}

function serializeRun(run: Run): SerializedRun {
  return {
    ...run,
    timestamp: run.timestamp.toISOString(),
    results: run.results.map((r) => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
    })),
  };
}

function deserializeRun(s: SerializedRun): Run {
  return {
    ...s,
    timestamp: new Date(s.timestamp),
    results: s.results.map((r) => ({
      ...r,
      timestamp: new Date(r.timestamp),
      violations: r.violations ?? [],
    })) as AnalyteResult[],
  };
}

// ─── LocalStorageService ──────────────────────────────────────────────────────

export class LocalStorageService implements DatabaseService {
  private readonly key: string;
  private sameTabListeners: Array<(state: StoredState) => void> = [];

  constructor(labId: string) {
    // Namespaced per lab to support multiple labs in the same browser
    this.key = `cq_hematologia_${labId}`;
  }

  // ── saveState ──────────────────────────────────────────────────────────────

  async saveState(state: StoredState): Promise<void> {
    const persisted: PersistedState = {
      v:                 SCHEMA_VERSION,
      activeLotId:       state.activeLotId,
      selectedAnalyteId: state.selectedAnalyteId,
      lots:              state.lots.map(serializeLot),
    };

    try {
      localStorage.setItem(this.key, JSON.stringify(persisted));
    } catch {
      // QuotaExceededError — common in private/incognito mode or heavy usage
      throw new Error(
        'Armazenamento local insuficiente. Verifique o espaço disponível no navegador.'
      );
    }

    // Notify same-tab listeners immediately (storage event only fires in other tabs)
    this.sameTabListeners.forEach((cb) => cb(state));
  }

  // ── loadState ──────────────────────────────────────────────────────────────

  async loadState(): Promise<StoredState | null> {
    const raw = localStorage.getItem(this.key);
    if (raw === null) return null;

    try {
      const persisted = JSON.parse(raw) as PersistedState;

      if (persisted.v !== SCHEMA_VERSION) {
        // Schema mismatch — discard rather than crash or corrupt
        console.warn(
          `[LocalStorageService] Schema mismatch (stored v${persisted.v}, expected v${SCHEMA_VERSION}). Discarding.`
        );
        localStorage.removeItem(this.key);
        return null;
      }

      return {
        activeLotId:       persisted.activeLotId,
        selectedAnalyteId: persisted.selectedAnalyteId,
        lots:              persisted.lots.map(deserializeLot),
      };
    } catch (err) {
      console.error('[LocalStorageService] Failed to parse stored state:', err);
      return null;
    }
  }

  // ── subscribeToState ───────────────────────────────────────────────────────
  // Emits initial state synchronously-ish (via microtask), then listens for
  // cross-tab changes via the native `storage` event.

  subscribeToState(callback: (state: StoredState) => void): Unsubscribe {
    // Emit current state on subscribe (mirrors Firebase onSnapshot behavior)
    this.loadState().then((state) => {
      if (state !== null) callback(state);
    });

    // Register for same-tab updates (triggered from saveState)
    this.sameTabListeners.push(callback);

    // Cross-tab sync via browser storage event
    const crossTabHandler = (e: StorageEvent) => {
      if (e.key !== this.key || e.newValue === null) return;
      try {
        const persisted = JSON.parse(e.newValue) as PersistedState;
        callback({
          activeLotId:       persisted.activeLotId,
          selectedAnalyteId: persisted.selectedAnalyteId,
          lots:              persisted.lots.map(deserializeLot),
        });
      } catch {
        // Ignore malformed events from other tabs
      }
    };

    window.addEventListener('storage', crossTabHandler);

    return () => {
      this.sameTabListeners = this.sameTabListeners.filter((l) => l !== callback);
      window.removeEventListener('storage', crossTabHandler);
    };
  }

  // ── uploadFile ─────────────────────────────────────────────────────────────
  // No persistent binary storage in local mode.
  // Returns an object URL valid for the current browser session.

  async uploadFile(file: File, _path: string): Promise<string> {
    return URL.createObjectURL(file);
  }

  // ── Granular writes ────────────────────────────────────────────────────────
  // LocalStorage has no partial-write story, so each helper rebuilds the full
  // state from disk, applies the change, and writes it back. The granularity
  // still matters for the Firebase implementation, which has real cost.

  async saveAppState(patch: AppStatePatch): Promise<void> {
    const current = (await this.loadState()) ?? { lots: [], activeLotId: null, selectedAnalyteId: null };
    await this.saveState({ ...current, ...patch });
  }

  async saveLot(lot: ControlLot): Promise<void> {
    const current = (await this.loadState()) ?? { lots: [], activeLotId: null, selectedAnalyteId: null };
    const existed = current.lots.some((l) => l.id === lot.id);
    const lots = existed
      ? current.lots.map((l) => (l.id === lot.id ? lot : l))
      : [...current.lots, lot];
    await this.saveState({ ...current, lots });
  }

  async deleteLot(lotId: string): Promise<void> {
    const current = (await this.loadState()) ?? { lots: [], activeLotId: null, selectedAnalyteId: null };
    const lots = current.lots.filter((l) => l.id !== lotId);
    const activeLotId = current.activeLotId === lotId ? (lots[0]?.id ?? null) : current.activeLotId;
    await this.saveState({ ...current, lots, activeLotId });
  }

  async saveRun(lotId: string, run: Run): Promise<void> {
    const current = (await this.loadState()) ?? { lots: [], activeLotId: null, selectedAnalyteId: null };
    const lots = current.lots.map((l) => {
      if (l.id !== lotId) return l;
      const existed = l.runs.some((r) => r.id === run.id);
      const runs = existed
        ? l.runs.map((r) => (r.id === run.id ? run : r))
        : [...l.runs, run];
      return { ...l, runs };
    });
    await this.saveState({ ...current, lots });
  }

  async deleteRun(lotId: string, runId: string): Promise<void> {
    const current = (await this.loadState()) ?? { lots: [], activeLotId: null, selectedAnalyteId: null };
    const lots = current.lots.map((l) =>
      l.id === lotId ? { ...l, runs: l.runs.filter((r) => r.id !== runId) } : l
    );
    await this.saveState({ ...current, lots });
  }
}
