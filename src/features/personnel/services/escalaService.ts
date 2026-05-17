/**
 * personnel/services/escalaService.ts
 *
 * Firestore path: `personnel/{labId}/escalas/{id}`
 * Multi-tenant, soft-delete only (RN-06).
 */

import {
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { EscalaDiaria, EscalaDiariaInput, LabId } from '../types';
import type { EscalaColaborador } from '../types/Escala';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PERSONNEL_ROOT = 'personnel';

const labRootDoc = (labId: LabId): DocumentReference => doc(db, PERSONNEL_ROOT, labId);

const escalasCol = (labId: LabId): CollectionReference => collection(labRootDoc(labId), 'escalas');

const escalaDoc = (labId: LabId, escalaId: string): DocumentReference =>
  doc(escalasCol(labId), escalaId);

async function ensureLabRoot(labId: LabId): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Mapping ────────────────────────────────────────────────────────────────

function mapEscala(snap: QueryDocumentSnapshot): EscalaDiaria {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as string,
    data: d.data as Timestamp,
    turno: d.turno as EscalaDiaria['turno'],
    colaboradores: (d.colaboradores ?? []) as EscalaColaborador[],
    rtPresente: Boolean(d.rtPresente),
    rtSubstitutoPresente: Boolean(d.rtSubstitutoPresente),
    observacoes: d.observacoes as string | undefined,
    criadoEm: d.criadoEm as Timestamp,
    updatedAt: d.updatedAt as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to escalas within a date range (real-time).
 */
export function watchEscalas(
  labId: LabId,
  startDate: Timestamp,
  endDate: Timestamp,
  callback: (escalas: EscalaDiaria[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    escalasCol(labId),
    where('deletadoEm', '==', null),
    where('data', '>=', startDate),
    where('data', '<=', endDate),
    orderBy('data', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map(mapEscala));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}

/**
 * Create a new escala entry.
 */
export async function createEscala(labId: LabId, input: EscalaDiariaInput): Promise<string> {
  await ensureLabRoot(labId);
  const ref = doc(escalasCol(labId));
  await setDoc(ref, {
    labId,
    data: input.data,
    turno: input.turno,
    colaboradores: input.colaboradores,
    rtPresente: input.rtPresente,
    rtSubstitutoPresente: input.rtSubstitutoPresente,
    observacoes: input.observacoes ?? null,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

/**
 * Update an existing escala.
 */
export async function updateEscala(
  labId: LabId,
  escalaId: string,
  updates: Partial<Pick<EscalaDiariaInput, 'turno' | 'colaboradores' | 'rtPresente' | 'rtSubstitutoPresente' | 'observacoes'>>,
): Promise<void> {
  const ref = escalaDoc(labId, escalaId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Soft-delete an escala (RN-06).
 */
export async function softDeleteEscala(labId: LabId, escalaId: string): Promise<void> {
  await updateDoc(escalaDoc(labId, escalaId), {
    deletadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
