/**
 * bioquimica/services/bioquimicaService.ts
 *
 * Camada de persistência multi-tenant do módulo bioquimica.
 *
 * Schema Firestore (CTO lock 2026-05-06):
 *
 *   /labs/{labId}/bioquimica/
 *     config/{singleton}              — enabled, seededAt, westgardConfig
 *     analitos/{analitoId}            — 17 seed + custom labs
 *     equipamentos-config/{eqId}      — bind opcional (analytics flag)
 *     lotes/{lotId}                   — ControlMaterial
 *     runs/{runId}                    — Run (callable-only após Plan 09-04)
 *     traceability-events/{eventId}   — append-only
 *     audit/{logId}                   — append-only audit trail
 *
 * Toda função recebe `labId` como parâmetro posicional obrigatório — não há
 * caminho que permita escrita sem tenant. Documentos carregam `labId`
 * redundante (defense-in-depth nas rules).
 *
 * RN-06 (soft-delete only): nenhuma função invoca `deleteDoc`. Guarda de 5
 * anos conforme RDC 978/2025 Art. 13.
 *
 * Cleanup: subscribe* sempre retornam Unsubscribe — caller obrigado a
 * invocar em useEffect cleanup para evitar leak de listeners.
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  Analito,
  ControlMaterial,
  EquipmentId,
  LabId,
  Run,
  UserId,
} from '../types';

// ─── Paths ─────────────────────────────────────────────────────────────────

const LABS_ROOT = 'labs';
const BIOQUIMICA_SEGMENT = 'bioquimica';

const labDoc = (labId: LabId): DocumentReference => doc(db, LABS_ROOT, labId);

const bioquimicaRoot = (labId: LabId): DocumentReference =>
  doc(labDoc(labId), 'modules', BIOQUIMICA_SEGMENT);

const analitosCol = (labId: LabId): CollectionReference =>
  collection(labDoc(labId), BIOQUIMICA_SEGMENT, 'root', 'analitos');

const lotesCol = (labId: LabId): CollectionReference =>
  collection(labDoc(labId), BIOQUIMICA_SEGMENT, 'root', 'lotes');

const runsCol = (labId: LabId): CollectionReference =>
  collection(labDoc(labId), BIOQUIMICA_SEGMENT, 'root', 'runs');

const configDoc = (labId: LabId, singleton = 'main'): DocumentReference =>
  doc(labDoc(labId), BIOQUIMICA_SEGMENT, 'root', 'config', singleton);

const analitoDoc = (labId: LabId, analitoId: string): DocumentReference =>
  doc(analitosCol(labId), analitoId);

const lotDoc = (labId: LabId, lotId: string): DocumentReference =>
  doc(lotesCol(labId), lotId);

/**
 * Garante que o doc raiz `/labs/{labId}/bioquimica/root` existe antes de
 * escrever em subcoleções. Idempotente via `merge: true`.
 *
 * Nota de schema: o segmento `bioquimica/root` é uma âncora que permite usar
 * subcoleções tipadas (analitos, lotes, runs) abaixo do mesmo namespace
 * dentro de `/labs/{labId}/bioquimica/{...}`. Rules tratam todo o caminho
 * abaixo de `/labs/{labId}/bioquimica/{document=**}` uniformemente.
 */
export async function ensureBioquimicaRoot(labId: LabId): Promise<void> {
  await setDoc(
    bioquimicaRoot(labId),
    { labId, module: BIOQUIMICA_SEGMENT },
    { merge: true },
  );
}

// ─── Mapping snapshot → entidade ──────────────────────────────────────────

function mapAnalito(snap: QueryDocumentSnapshot): Analito {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    nome: d.nome as string,
    sigla: (d.sigla ?? undefined) as string | undefined,
    unidade: d.unidade as string,
    unidadeSI: (d.unidadeSI ?? undefined) as string | undefined,
    rangeBiologico: d.rangeBiologico as { min: number; max: number },
    metodo: (d.metodo ?? undefined) as string | undefined,
    cvAlvo: (d.cvAlvo ?? undefined) as number | undefined,
    ativo: Boolean(d.ativo),
    seedDefault: Boolean(d.seedDefault),
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapControlMaterial(snap: QueryDocumentSnapshot): ControlMaterial {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipmentIds: (d.equipmentIds ?? []) as readonly EquipmentId[],
    fornecedor: d.fornecedor as string,
    lote: d.lote as string,
    validade: d.validade as Timestamp,
    niveis: d.niveis ?? [],
    bulaPendente: Boolean(d.bulaPendente),
    bulaPdfUrl: (d.bulaPdfUrl ?? undefined) as string | undefined,
    manufacturerStats: (d.manufacturerStats ?? null) as ControlMaterial['manufacturerStats'],
    origem: (d.origem ?? 'avulso') as ControlMaterial['origem'],
    archivedAt: (d.archivedAt ?? undefined) as Timestamp | undefined,
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapRun(snap: QueryDocumentSnapshot): Run {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipmentId: d.equipmentId as EquipmentId,
    lotId: d.lotId as string,
    operatorId: d.operatorId as UserId,
    capturaEm: d.capturaEm as Timestamp,
    resultados: (d.resultados ?? {}) as Run['resultados'],
    violations: (d.violations ?? []) as Run['violations'],
    status: (d.status ?? 'Pendente') as Run['status'],
    aproveitamento: (d.aproveitamento ?? 'oficial') as Run['aproveitamento'],
    reagentesSnapshot: (d.reagentesSnapshot ?? []) as Run['reagentesSnapshot'],
    complianceOverride: d.complianceOverride as Run['complianceOverride'],
    signature: d.signature as Run['signature'],
    chainHash: d.chainHash as string,
    criadoEm: d.criadoEm as Timestamp,
  };
}

// ─── Subscribe API ────────────────────────────────────────────────────────

/**
 * Subscribe ao singleton de configuração do módulo (enabled, seededAt, etc).
 */
export function subscribeBioquimicaConfig(
  labId: LabId,
  callback: (config: { enabled?: boolean; seededAt?: Timestamp } | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    configDoc(labId),
    (snap) => {
      callback(snap.exists() ? (snap.data() as { enabled?: boolean; seededAt?: Timestamp }) : null);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Subscribe a todos os analitos do lab (não deletados, ordenados por nome).
 * Filtro de `deletadoEm` é client-side enquanto volume ≤5k docs por tenant.
 */
export function subscribeAnalitos(
  labId: LabId,
  callback: (list: Analito[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(analitosCol(labId), orderBy('nome', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapAnalito).filter((a) => a.deletadoEm === null);
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Subscribe a lotes do lab — todos os equipamentos.
 * Para filtrar por equipmentId, faça in-memory (`equipmentIds.includes(...)`).
 */
export function subscribeLotes(
  labId: LabId,
  callback: (list: ControlMaterial[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(lotesCol(labId), orderBy('criadoEm', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapControlMaterial).filter((l) => l.deletadoEm === null);
      callback(list);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Subscribe a runs recentes de um equipamento (últimos N dias).
 *
 * Por que filtrar por equipmentId no path: evita ler todas as runs do lab
 * quando UI mostra apenas LeveyJennings de 1 equipamento. Reduz custos
 * Firestore (Threat T2 — performance profile no CONTEXT).
 */
export function subscribeRuns(
  labId: LabId,
  equipmentId: EquipmentId,
  daysBack: number = 30,
  callback?: (list: Run[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const cutoff = Timestamp.fromMillis(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const q = query(
    runsCol(labId),
    where('equipmentId', '==', equipmentId),
    where('criadoEm', '>=', cutoff),
    orderBy('criadoEm', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(mapRun);
      callback?.(list);
    },
    (err) => onError?.(err as Error),
  );
}

// ─── Mutations (soft-delete only) ─────────────────────────────────────────

/**
 * Soft-deleta um analito. Nunca remove fisicamente — auditor exige histórico.
 * Marca quem fez a operação (`deletadoPor`) para trilha.
 */
export async function softDeleteAnalito(
  labId: LabId,
  analitoId: string,
  operatorId: UserId,
): Promise<void> {
  await updateDoc(analitoDoc(labId, analitoId), {
    deletadoEm: serverTimestamp(),
    deletadoPor: operatorId,
  });
}

/**
 * Soft-deleta um lote — Westgard automaticamente para de avaliar runs novas
 * desse lote (rule check em `recordRunBioquimica` callable, Plan 09-04).
 */
export async function softDeleteLot(
  labId: LabId,
  lotId: string,
  operatorId: UserId,
): Promise<void> {
  await updateDoc(lotDoc(labId, lotId), {
    deletadoEm: serverTimestamp(),
    deletadoPor: operatorId,
  });
}

// ─── Single-doc reads ─────────────────────────────────────────────────────

export async function getAnalito(
  labId: LabId,
  analitoId: string,
): Promise<Analito | null> {
  const snap = await getDoc(analitoDoc(labId, analitoId));
  if (!snap.exists()) return null;
  const a = mapAnalito(snap as QueryDocumentSnapshot);
  if (a.deletadoEm !== null) return null;
  return a;
}

export async function getLot(
  labId: LabId,
  lotId: string,
): Promise<ControlMaterial | null> {
  const snap = await getDoc(lotDoc(labId, lotId));
  if (!snap.exists()) return null;
  const l = mapControlMaterial(snap as QueryDocumentSnapshot);
  if (l.deletadoEm !== null) return null;
  return l;
}

// ─── Layer for subscribeToState (Plan 09-02 hook integration) ─────────────
//
// Expõe os paths e mappers para que o hook agregador `useBioquimicaState`
// monte o estado consolidado num único `useEffect` com 3 listeners. Mantém
// a interface consistente com o pattern de hematologia.

export const bioquimicaLayer = {
  ensureRoot: ensureBioquimicaRoot,
  subscribeAnalitos,
  subscribeLotes,
  subscribeRuns,
  subscribeConfig: subscribeBioquimicaConfig,
} as const;
