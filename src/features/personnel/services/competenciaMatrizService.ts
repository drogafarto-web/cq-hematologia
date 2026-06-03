/**
 * personnel/services/competenciaMatrizService.ts
 *
 * CRUD multi-tenant para Competências Técnicas (Matriz de Competências).
 * Firestore path: `personnel/{labId}/competencias/{id}`
 *
 * RN-06: soft-delete only.
 * DICQ 5.1.4 + ISO 15189:2022 6.2.3
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
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CompetenciaTecnica,
  CompetenciaTecnicaInput,
  CategoriaCompetencia,
} from '../types/CompetenciaMatriz';

type LabId = string;

// ─── Paths ──────────────────────────────────────────────────────────────────

const competenciasCol = (labId: LabId) => collection(db, 'personnel', labId, 'competencias');

const competenciaDoc = (labId: LabId, id: string) =>
  doc(db, 'personnel', labId, 'competencias', id);

// ─── Watch (realtime) ───────────────────────────────────────────────────────

export interface WatchCompetenciasOptions {
  categoria?: CategoriaCompetencia;
  colaboradorId?: string;
}

export function watchCompetencias(
  labId: LabId,
  callback: (items: CompetenciaTecnica[]) => void,
  onError?: (err: Error) => void,
  options?: WatchCompetenciasOptions,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null), orderBy('colaboradorNome', 'asc')];

  if (options?.categoria) {
    constraints.unshift(where('categoria', '==', options.categoria));
  }
  if (options?.colaboradorId) {
    constraints.unshift(where('colaboradorId', '==', options.colaboradorId));
  }

  const q = query(competenciasCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CompetenciaTecnica);
      callback(items);
    },
    (err) => {
      console.error('[competenciaMatrizService] watch error:', err);
      onError?.(err);
    },
  );
}

// ─── Upsert ─────────────────────────────────────────────────────────────────

export async function upsertCompetencia(
  labId: LabId,
  input: CompetenciaTecnicaInput,
  existingId?: string,
): Promise<string> {
  const id = existingId || doc(competenciasCol(labId)).id;
  const ref = competenciaDoc(labId, id);

  const payload = {
    ...input,
    labId,
    updatedAt: serverTimestamp(),
    ...(existingId ? {} : { criadoEm: serverTimestamp(), deletadoEm: null }),
  };

  await setDoc(ref, payload, { merge: true });
  return id;
}

// ─── Soft Delete ────────────────────────────────────────────────────────────

export async function softDeleteCompetencia(labId: LabId, id: string): Promise<void> {
  const ref = competenciaDoc(labId, id);
  await updateDoc(ref, {
    deletadoEm: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}
