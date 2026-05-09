/**
 * capaService.ts — Phase 8 Wave 1
 *
 * Firestore CRUD read-only for CAPA tracking.
 * No business logic — only queries, snapshots, and entity mapping.
 *
 * Multi-tenant: `/labs/{labId}/capa-tracking/{capaId}`
 * Soft-delete only (RN-06) — never invoke deleteDoc
 * LogicalSignature validation in Cloud Function callables
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CapaDocument,
  CapaState,
} from '../types';
import { daysRemaining } from '../types';
import type { LabId } from '../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const capaCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'capa-tracking');

const capaDoc = (labId: LabId, capaId: string): DocumentReference =>
  doc(capaCol(labId), capaId);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapCapaDocument(snap: QueryDocumentSnapshot): CapaDocument {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    ncId: d.ncId as string | undefined,
    finding: {
      findingId: d.finding.findingId,
      title: d.finding.title,
      severity: d.finding.severity,
      dicqBlocks: d.finding.dicqBlocks ?? [],
      rdcArticles: d.finding.rdcArticles ?? [],
    },
    state: d.state as CapaState,
    createdAt: d.createdAt.toMillis?.() ?? d.createdAt,
    createdBy: d.createdBy as string,
    rootCause: d.rootCause as string,
    correctiveAction: d.correctiveAction as string,
    deadlineDate: d.deadlineDate.toMillis?.() ?? d.deadlineDate,
    evidence: d.evidence ?? [],
    rfiLog: d.rfiLog ?? [],
    stateHistory: d.stateHistory ?? [],
    auditorSignOffEmail: d.auditorSignOffEmail,
    auditorSignOffAt: d.auditorSignOffAt,
    deletedAt: d.deletedAt,
  } as CapaDocument;
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get a single CAPA by ID with daysRemaining calculated at read time.
 */
export async function getCapaById(labId: LabId, capaId: string): Promise<(CapaDocument & { daysRemaining: number }) | null> {
  const snap = await getDoc(capaDoc(labId, capaId));
  if (!snap.exists()) return null;
  const capa = mapCapaDocument(snap);
  const deadlineMs = typeof capa.deadlineDate === 'number' ? capa.deadlineDate : (capa.deadlineDate as any)?.toMillis?.() ?? 0;
  return {
    ...capa,
    daysRemaining: daysRemaining(deadlineMs),
  };
}

/**
 * Subscribe to all CAPAs in the lab, optionally filtered by state.
 * daysRemaining calculated on each update.
 */
export function subscribeToCapas(
  labId: LabId,
  onUpdate: (capas: Array<CapaDocument & { daysRemaining: number }>) => void,
  filterState?: CapaState,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = filterState
    ? query(capaCol(labId), where('state', '==', filterState), orderBy('deadlineDate', 'asc'))
    : query(capaCol(labId), orderBy('deadlineDate', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const capas = snapshot.docs
        .map(mapCapaDocument)
        .map((capa) => {
          const deadlineMs = typeof capa.deadlineDate === 'number' ? capa.deadlineDate : (capa.deadlineDate as any)?.toMillis?.() ?? 0;
          return {
            ...capa,
            daysRemaining: daysRemaining(deadlineMs),
          };
        });
      onUpdate(capas);
    },
    (err) => {
      if (onError) onError(new Error(`Subscribe error: ${err.message}`));
    },
  );
}

/**
 * List all CAPAs in the lab with optional filtering and sorting.
 * Synchronous snapshot — prefer subscribeToCapas for reactive updates.
 */
export async function listCapas(
  labId: LabId,
  filterState?: CapaState,
  sortBy: 'deadline' | 'created' = 'deadline',
): Promise<Array<CapaDocument & { daysRemaining: number }>> {
  const orderField = sortBy === 'deadline' ? 'deadlineDate' : 'createdAt';
  const q = filterState
    ? query(capaCol(labId), where('state', '==', filterState), orderBy(orderField, 'asc'))
    : query(capaCol(labId), orderBy(orderField, 'asc'));

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(mapCapaDocument)
    .filter((capa) => !filterState || capa.state === filterState)
    .map((capa) => {
      const deadlineMs = typeof capa.deadlineDate === 'number' ? capa.deadlineDate : (capa.deadlineDate as any)?.toMillis?.() ?? 0;
      return {
        ...capa,
        daysRemaining: daysRemaining(deadlineMs),
      };
    });
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const capaService = {
  getCapaById,
  subscribeToCapas,
  listCapas,
};
