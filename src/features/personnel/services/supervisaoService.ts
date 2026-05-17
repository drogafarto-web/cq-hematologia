/**
 * personnel/services/supervisaoService.ts
 *
 * CRUD multi-tenant para Supervisões.
 * Firestore path: `personnel/{labId}/supervisoes/{id}`
 *
 * RN-06: soft-delete only.
 * RDC 978/2025 Art. 122 + DICQ 4.1.2.7
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
  updateDoc,
  where,
  Timestamp,
  type CollectionReference,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { SupervisaoRegistro, SupervisaoInput } from '../types/Supervisao';

type LabId = string;

// ─── Paths ──────────────────────────────────────────────────────────────────

const supervisoesCol = (labId: LabId): CollectionReference =>
  collection(db, 'personnel', labId, 'supervisoes');

// ─── Watch (realtime) ───────────────────────────────────────────────────────

export function watchSupervisoes(
  labId: LabId,
  callback: (items: SupervisaoRegistro[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    supervisoesCol(labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupervisaoRegistro));
      callback(items);
    },
    (err) => {
      console.error('[supervisaoService] watch error:', err);
      onError?.(err);
    },
  );
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createSupervisao(
  labId: LabId,
  input: SupervisaoInput,
): Promise<string> {
  const ref = doc(supervisoesCol(labId));
  await setDoc(ref, {
    ...input,
    labId,
    dataInicioSupervisao: input.dataInicioSupervisao,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });
  return ref.id;
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateSupervisao(
  labId: LabId,
  id: string,
  updates: Partial<Pick<SupervisaoRegistro, 'status' | 'checklistConcluido' | 'dataLiberacao' | 'observacoes'>>,
): Promise<void> {
  const ref = doc(supervisoesCol(labId), id);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ─── Soft Delete ────────────────────────────────────────────────────────────

export async function softDeleteSupervisao(
  labId: LabId,
  id: string,
): Promise<void> {
  const ref = doc(supervisoesCol(labId), id);
  await updateDoc(ref, {
    deletadoEm: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}
