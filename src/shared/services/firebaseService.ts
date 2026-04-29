import {
  db,
  storage,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  onSnapshot,
  query,
  where,
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
  'id' | 'runs' | 'startDate' | 'expiryDate' | 'createdAt' | 'archivedAt'
> & {
  startDate: Timestamp;
  expiryDate: Timestamp;
  createdAt: Timestamp;
  archivedAt?: Timestamp;
};

type FirestoreRunDoc = Omit<Run, 'id' | 'timestamp' | 'results'> & {
  timestamp: Timestamp;
  results: FirestoreAnalyteResult[];
};

type FirestoreAnalyteResult = Omit<AnalyteResult, 'timestamp'> & {
  timestamp: Timestamp;
};

function serializeLot(lot: Omit<ControlLot, 'runs'>): FirestoreLotDoc {
  const { id: _id, startDate, expiryDate, createdAt, archivedAt, ...rest } = lot;
  return {
    ...rest,
    startDate: Timestamp.fromDate(startDate),
    expiryDate: Timestamp.fromDate(expiryDate),
    createdAt: Timestamp.fromDate(createdAt),
    // archivedAt é opcional — só inclui se presente (Firestore rejeita undefined).
    ...(archivedAt && { archivedAt: Timestamp.fromDate(archivedAt) }),
  };
}

function deserializeLot(id: string, raw: Record<string, unknown>, runs: Run[]): ControlLot {
  const d = raw as FirestoreLotDoc & {
    bulaPendente?: boolean;
    archivedAt?: Timestamp;
  };
  // manufacturerStats null = "lote sem bula"; UI desenha estado pendente
  // em vez de zeros silenciosos. Ausência total = mesmo tratamento.
  const mfr = d.manufacturerStats;
  const manufacturerStats =
    mfr && Object.keys(mfr).length > 0 ? (mfr as ManufacturerStats) : null;
  return {
    id,
    labId: d.labId,
    lotNumber: d.lotNumber,
    controlName: d.controlName,
    equipmentName: d.equipmentName,
    serialNumber: d.serialNumber,
    level: d.level,
    requiredAnalytes: d.requiredAnalytes ?? [],
    manufacturerStats,
    statistics: (d.statistics ?? null) as InternalStats | null,
    runCount: d.runCount ?? 0,
    createdBy: d.createdBy,
    startDate: d.startDate.toDate(),
    expiryDate: d.expiryDate.toDate(),
    createdAt: d.createdAt.toDate(),
    runs,
    ...(d.manualHidden !== undefined && { manualHidden: d.manualHidden }),
    ...(d.bulaPendente !== undefined && { bulaPendente: d.bulaPendente }),
    ...(d.archivedAt && { archivedAt: d.archivedAt.toDate() }),
  };
}

// Adapter de leitura InsumoControle → ControlLot pro dual-source de
// subscribeToState. Retorna null se o doc não for tipo='controle'.
function deserializeInsumoToControlLot(
  id: string,
  raw: Record<string, unknown>,
  runs: Run[],
): ControlLot | null {
  if (raw.tipo !== 'controle') return null;

  const startDateTs = (raw.startDate ?? raw.createdAt) as Timestamp | undefined;
  const expiryDateTs = (raw.validade ?? raw.expiryDate) as Timestamp | undefined;
  const createdAtTs = raw.createdAt as Timestamp | undefined;
  if (!expiryDateTs || !createdAtTs) return null;

  // bulaLevel preservado pela migração; senão derivado do nivel categórico.
  let level: 1 | 2 | 3;
  if (raw.bulaLevel === 1 || raw.bulaLevel === 2 || raw.bulaLevel === 3) {
    level = raw.bulaLevel;
  } else {
    const nivel = raw.nivel as string | undefined;
    if (nivel === 'baixo' || nivel === 'positivo') level = 1;
    else if (nivel === 'alto' || nivel === 'patologico') level = 3;
    else level = 2;
  }

  // Stats: prefer `stats` (Insumo schema), fallback `manufacturerStats` (legacy).
  const stats = (raw.stats ?? raw.manufacturerStats ?? {}) as ManufacturerStats;

  // Internal stats em InsumoControle tem `{mean, sd, n}`; ControlLot espera só `{mean, sd}`.
  let statistics: InternalStats | null = null;
  if (raw.internalStats && typeof raw.internalStats === 'object') {
    const inner: InternalStats = {};
    for (const [analyteId, s] of Object.entries(
      raw.internalStats as Record<string, { mean: number; sd: number }>,
    )) {
      inner[analyteId] = { mean: s.mean, sd: s.sd };
    }
    statistics = inner;
  } else if (raw.statistics) {
    statistics = raw.statistics as InternalStats;
  }

  const requiredAnalytes =
    (raw.requiredAnalytes as string[] | undefined) ??
    (Array.isArray(stats) ? [] : Object.keys(stats));

  return {
    id,
    labId: raw.labId as string,
    lotNumber: (raw.lote ?? raw.lotNumber ?? id) as string,
    controlName: (raw.controlProgramName ?? raw.nomeComercial ?? '') as string,
    equipmentName: (raw.equipmentName ?? '') as string,
    serialNumber: (raw.serialNumber ?? '') as string,
    level,
    requiredAnalytes,
    manufacturerStats: stats,
    statistics,
    runCount: (raw.runCount as number | undefined) ?? runs.length,
    createdBy: (raw.createdBy as string | undefined) ?? '',
    startDate: (startDateTs ?? createdAtTs).toDate(),
    expiryDate: expiryDateTs.toDate(),
    createdAt: createdAtTs.toDate(),
    runs,
    ...(typeof raw.manualHidden === 'boolean' && { manualHidden: raw.manualHidden }),
    // Flags operacionais — sem isso o dual-source merge sobrescreve o estado
    // de /lots (onde elas vivem) com o /insumos (onde elas sumiriam).
    ...(typeof raw.bulaPendente === 'boolean' && { bulaPendente: raw.bulaPendente }),
    ...(raw.archivedAt instanceof Timestamp && {
      archivedAt: raw.archivedAt.toDate(),
    }),
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

  private insumosCol() {
    return collection(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.INSUMOS);
  }

  private insumoRunsCol(insumoId: string) {
    return collection(
      db,
      COLLECTIONS.LABS,
      this.labId,
      SUBCOLLECTIONS.INSUMOS,
      insumoId,
      SUBCOLLECTIONS.RUNS,
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

  // ── subscribeToState (dual-source) ───────────────────────────────────────
  // Listener com 5 camadas:
  //   1. appState (activeLotId, selectedAnalyteId)
  //   2. /lots metadata           (legacy source — fallback)
  //   3. /lots/{id}/runs          (sub-coleção legacy)
  //   4. /insumos com tipo='controle' metadata  (PRIMARY após migração)
  //   5. /insumos/{id}/runs       (sub-coleção primária após migração)
  //
  // Merge rules:
  //   - Metadata: /insumos sobrepõe /lots quando ID coincide (cutover).
  //   - Runs: união por run.id. Cada run.id aparece uma vez (dedupe). Quando
  //     a migração tiver copiado runs pra /insumos/{id}/runs, ambas as
  //     fontes contribuem com o mesmo run.id e o dedupe é estável.
  //
  // Antes da migração rodar:
  //   - /insumos só tem novos lotes (dual-write em useLots.addLot) sem runs
  //   - /lots tem todos lotes + runs históricas
  //   - UI vê tudo de /lots, com /insumos sobrepondo metadata onde existe
  //
  // Após migração:
  //   - /insumos tem tudo + runs em sub-coleção
  //   - Merge ainda funcional, /insumos é a fonte primária
  //
  // Emite só após primeiras snapshots de TODAS as camadas — sem flash vazio.

  subscribeToState(callback: (state: StoredState) => void): Unsubscribe {
    let appStateData = {
      activeLotId: null as string | null,
      selectedAnalyteId: null as string | null,
    };

    // Maps separados por fonte — merge no emit() pra simplicidade.
    const metaFromLots = new Map<string, Omit<ControlLot, 'runs'>>();
    const metaFromInsumos = new Map<string, Omit<ControlLot, 'runs'>>();
    const runsFromLots = new Map<string, Run[]>();
    const runsFromInsumos = new Map<string, Run[]>();

    const lotsRunUnsubbers = new Map<string, () => void>();
    const insumosRunUnsubbers = new Map<string, () => void>();

    let appStateReady = false;
    let lotsReady = false;
    let insumosReady = false;
    const pendingRunInitLots = new Set<string>();
    const pendingRunInitInsumos = new Set<string>();

    const emit = () => {
      if (
        !appStateReady ||
        !lotsReady ||
        !insumosReady ||
        pendingRunInitLots.size > 0 ||
        pendingRunInitInsumos.size > 0
      )
        return;

      // Merge metadata por ID: /insumos vence quando ID coincide.
      const mergedById = new Map<string, Omit<ControlLot, 'runs'>>();
      for (const [id, meta] of metaFromLots) mergedById.set(id, meta);
      for (const [id, meta] of metaFromInsumos) mergedById.set(id, meta);

      // Constrói entries com runs unificadas por run.id.
      const candidates: ControlLot[] = [];
      for (const [id, meta] of mergedById) {
        const byRunId = new Map<string, Run>();
        for (const r of runsFromLots.get(id) ?? []) byRunId.set(r.id, r);
        for (const r of runsFromInsumos.get(id) ?? []) byRunId.set(r.id, r);
        candidates.push({ ...meta, runs: Array.from(byRunId.values()) });
      }

      // Dedupe adicional por chave natural (lotNumber + level + controlName).
      // O MESMO lote físico pode ter sido cadastrado em /lots e /insumos com
      // IDs diferentes (ex: cadastro via Bula PDF + cadastro via NovoLote
      // catálogo) — sem isto, o operador veria "NV1 NV1 NV1" no level picker.
      // Critério de vencedor:
      //   1. mais runs (preserva histórico LJ/Westgard)
      //   2. empate em runs → o que veio de /insumos (futuro source-of-truth)
      const byNaturalKey = new Map<string, ControlLot>();
      for (const cand of candidates) {
        const key = `${cand.lotNumber}::${cand.level}::${cand.controlName}`;
        const existing = byNaturalKey.get(key);
        if (!existing) {
          byNaturalKey.set(key, cand);
          continue;
        }
        // Merge runs de ambas entradas — não descarta histórico.
        const allRuns = new Map<string, Run>();
        for (const r of existing.runs) allRuns.set(r.id, r);
        for (const r of cand.runs) allRuns.set(r.id, r);
        const candFromInsumos = metaFromInsumos.has(cand.id);
        const existingFromInsumos = metaFromInsumos.has(existing.id);
        const winnerMeta =
          cand.runs.length > existing.runs.length
            ? cand
            : existing.runs.length > cand.runs.length
              ? existing
              : candFromInsumos && !existingFromInsumos
                ? cand
                : existing;
        byNaturalKey.set(key, { ...winnerMeta, runs: Array.from(allRuns.values()) });
      }

      const lots = Array.from(byNaturalKey.values());
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

    // Layer 2: /lots metadata + Layer 3: /lots/{id}/runs (legacy)
    const lotsUnsub = onSnapshot(
      this.lotsCol(),
      (snap) => {
        for (const change of snap.docChanges()) {
          const lotId = change.doc.id;

          if (change.type === 'removed') {
            metaFromLots.delete(lotId);
            runsFromLots.delete(lotId);
            pendingRunInitLots.delete(lotId);
            lotsRunUnsubbers.get(lotId)?.();
            lotsRunUnsubbers.delete(lotId);
            continue;
          }

          const fullLot = deserializeLot(lotId, change.doc.data() as Record<string, unknown>, []);
          const { runs: _r, ...meta } = fullLot;
          metaFromLots.set(lotId, meta);

          if (!lotsRunUnsubbers.has(lotId)) {
            pendingRunInitLots.add(lotId);
            const runUnsub = onSnapshot(
              this.runsCol(lotId),
              (runsSnap) => {
                const runs = runsSnap.docs.map((d) =>
                  deserializeRun(d.id, d.data() as Record<string, unknown>),
                );
                runsFromLots.set(lotId, runs);
                pendingRunInitLots.delete(lotId);
                emit();
              },
              (err) =>
                console.error(`[FirebaseService] /lots/${lotId}/runs listener error:`, err),
            );
            lotsRunUnsubbers.set(lotId, runUnsub);
          }
        }

        lotsReady = true;
        emit();
      },
      (err) => console.error('[FirebaseService] /lots listener error:', err),
    );

    // Layer 4: /insumos com tipo='controle' + Layer 5: /insumos/{id}/runs
    //
    // CRÍTICO: filtra por módulo='hematologia'. /insumos é compartilhada entre
    // todos os módulos (imuno, coag, uro têm seus próprios controles). Sem
    // este filtro, o `useLots` (que é específico de hematologia, alimenta
    // LJ chart e Westgard) misturaria controles de PCR/imuno com sangue
    // controle Controllab — bagunçando level pickers e corrompendo gráficos.
    //
    // Filtro client-side em vez de query composta: docs legados pré-Fase A
    // (2026-04-21) só têm `modulo` (singular); docs novos têm `modulos[]`
    // (array, source-of-truth). Aceitamos ambos.
    function isHematologiaInsumo(raw: Record<string, unknown>): boolean {
      const modulos = raw['modulos'];
      if (Array.isArray(modulos) && modulos.length > 0) {
        return modulos.includes('hematologia');
      }
      return raw['modulo'] === 'hematologia';
    }

    const insumosQ = query(this.insumosCol(), where('tipo', '==', 'controle'));
    const insumosUnsub = onSnapshot(
      insumosQ,
      (snap) => {
        for (const change of snap.docChanges()) {
          const insumoId = change.doc.id;

          if (change.type === 'removed') {
            metaFromInsumos.delete(insumoId);
            runsFromInsumos.delete(insumoId);
            pendingRunInitInsumos.delete(insumoId);
            insumosRunUnsubbers.get(insumoId)?.();
            insumosRunUnsubbers.delete(insumoId);
            continue;
          }

          const rawData = change.doc.data() as Record<string, unknown>;

          // Filtra módulo ANTES de criar runs listener — evita assinar
          // sub-coleção de controle de outro módulo.
          if (!isHematologiaInsumo(rawData)) {
            // Se o doc estava antes (pré-edit que mudou módulo) e agora
            // sai do filtro, limpa pra evitar stale data.
            if (metaFromInsumos.has(insumoId)) {
              metaFromInsumos.delete(insumoId);
              runsFromInsumos.delete(insumoId);
              insumosRunUnsubbers.get(insumoId)?.();
              insumosRunUnsubbers.delete(insumoId);
              pendingRunInitInsumos.delete(insumoId);
            }
            continue;
          }

          const adapted = deserializeInsumoToControlLot(insumoId, rawData, []);
          if (!adapted) continue;
          const { runs: _r, ...meta } = adapted;
          metaFromInsumos.set(insumoId, meta);

          if (!insumosRunUnsubbers.has(insumoId)) {
            pendingRunInitInsumos.add(insumoId);
            const runUnsub = onSnapshot(
              this.insumoRunsCol(insumoId),
              (runsSnap) => {
                const runs = runsSnap.docs.map((d) =>
                  deserializeRun(d.id, d.data() as Record<string, unknown>),
                );
                runsFromInsumos.set(insumoId, runs);
                pendingRunInitInsumos.delete(insumoId);
                emit();
              },
              (err) =>
                console.error(
                  `[FirebaseService] /insumos/${insumoId}/runs listener error:`,
                  err,
                ),
            );
            insumosRunUnsubbers.set(insumoId, runUnsub);
          }
        }

        insumosReady = true;
        emit();
      },
      (err) => {
        // Pode falhar antes de rules permitirem ou se /insumos não existir
        // (lab novíssimo) — não quebra leitura: marca pronto pra emit não
        // ficar travado, /lots assume.
        console.warn('[FirebaseService] /insumos listener warning:', err);
        insumosReady = true;
        emit();
      },
    );

    return () => {
      appStateUnsub();
      lotsUnsub();
      insumosUnsub();
      lotsRunUnsubbers.forEach((unsub) => unsub());
      lotsRunUnsubbers.clear();
      insumosRunUnsubbers.forEach((unsub) => unsub());
      insumosRunUnsubbers.clear();
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
      // Primary write — /lots (legacy, source-of-truth durante transição)
      await setDoc(this.lotRef(lot.id), serializeLot(lotWithoutRuns));
      if (this.knownLotIds) this.knownLotIds.add(lot.id);

      // Dual-write /insumos preservando ID. merge:true preserva campos só
      // de /insumos (qcStatus, equipamentosPermitidos, etc). Falha vira
      // warning — /lots ficou íntegro.
      void this.replicateLotToInsumos(lot).catch((err) => {
        console.warn(
          `[dual-write] saveLot ${lot.id} → /insumos falhou: ${err instanceof Error ? err.message : err}`,
        );
      });
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

      // Dual-delete em /insumos. Best-effort.
      void (async () => {
        try {
          // Lê e deleta sub-coleção runs em /insumos/{lotId}/runs
          const runsSnap = await getDocs(this.insumoRunsCol(lotId));
          await runBatched([
            ...runsSnap.docs.map(
              (d): BatchOp =>
                (b) =>
                  b.delete(d.ref),
            ),
            (b) => b.delete(doc(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.INSUMOS, lotId)),
          ]);
        } catch (err) {
          console.warn(
            `[dual-write] deleteLot ${lotId} → /insumos falhou: ${err instanceof Error ? err.message : err}`,
          );
        }
      })();
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async saveRun(lotId: string, run: Run): Promise<void> {
    try {
      const serialized = serializeRun(run);
      await setDoc(this.runRef(lotId, run.id), serialized);
      if (this.knownRunIds) {
        const set = this.knownRunIds.get(lotId) ?? new Set<string>();
        set.add(run.id);
        this.knownRunIds.set(lotId, set);
      }

      // Dual-write em /insumos/{lotId}/runs/{runId} preservando ID.
      void setDoc(
        doc(
          db,
          COLLECTIONS.LABS,
          this.labId,
          SUBCOLLECTIONS.INSUMOS,
          lotId,
          SUBCOLLECTIONS.RUNS,
          run.id,
        ),
        serialized,
      ).catch((err) => {
        console.warn(
          `[dual-write] saveRun ${lotId}/${run.id} → /insumos falhou: ${err instanceof Error ? err.message : err}`,
        );
      });
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  async deleteRun(lotId: string, runId: string): Promise<void> {
    try {
      await runBatched([(b) => b.delete(this.runRef(lotId, runId))]);
      this.knownRunIds?.get(lotId)?.delete(runId);

      // Dual-delete em /insumos/{lotId}/runs/{runId}.
      void runBatched([
        (b) =>
          b.delete(
            doc(
              db,
              COLLECTIONS.LABS,
              this.labId,
              SUBCOLLECTIONS.INSUMOS,
              lotId,
              SUBCOLLECTIONS.RUNS,
              runId,
            ),
          ),
      ]).catch((err) => {
        console.warn(
          `[dual-write] deleteRun ${lotId}/${runId} → /insumos falhou: ${err instanceof Error ? err.message : err}`,
        );
      });
    } catch (err) {
      throw new Error(firestoreErrorMessage(err), { cause: err });
    }
  }

  // ── Dual-write replication helpers ────────────────────────────────────────

  /**
   * Replica metadata de um ControlLot para /insumos/{id} preservando ID.
   * Mapping mirror do `controlLotAdapter.insumoControleWriteDataFromControlLot`.
   * Usa merge:true para preservar campos exclusivos do /insumos (qcStatus etc).
   */
  private async replicateLotToInsumos(lot: ControlLot): Promise<void> {
    // Derivado mínimo — sem importar adapter pra não criar dependência cíclica
    // entre service e features. Mantém as decisões de mapeamento alinhadas com
    // controlLotAdapter.ts — qualquer mudança em um precisa refletir no outro.
    const nivel =
      lot.level === 1 ? 'baixo' : lot.level === 3 ? 'alto' : 'normal';
    const writeData: Record<string, unknown> = {
      labId: lot.labId,
      tipo: 'controle',
      nivel,
      modulo: 'hematologia',
      modulos: ['hematologia'],
      fabricante: 'Controllab',
      nomeComercial: lot.controlName,
      lote: lot.lotNumber,
      validade: Timestamp.fromDate(lot.expiryDate),
      dataAbertura: null,
      diasEstabilidadeAbertura: 0,
      validadeReal: Timestamp.fromDate(lot.expiryDate),
      status: lot.expiryDate.getTime() < Date.now() ? 'vencido' : 'ativo',
      createdAt: Timestamp.fromDate(lot.createdAt),
      createdBy: lot.createdBy,
      stats: lot.manufacturerStats,
      bulaLevel: lot.level,
      controlProgramName: lot.controlName,
      startDate: Timestamp.fromDate(lot.startDate),
      equipmentName: lot.equipmentName,
      serialNumber: lot.serialNumber,
      requiredAnalytes: lot.requiredAnalytes,
      runCount: lot.runCount,
    };
    if (lot.statistics) {
      const internalStats: Record<string, { mean: number; sd: number; n: number }> = {};
      for (const [analyteId, s] of Object.entries(lot.statistics)) {
        internalStats[analyteId] = { mean: s.mean, sd: s.sd, n: lot.runCount };
      }
      writeData.internalStats = internalStats;
    }
    if (lot.manualHidden !== undefined) {
      writeData.manualHidden = lot.manualHidden;
    }
    await setDoc(
      doc(db, COLLECTIONS.LABS, this.labId, SUBCOLLECTIONS.INSUMOS, lot.id),
      writeData,
      { merge: true },
    );
  }
}
