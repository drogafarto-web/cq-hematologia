/**
 * personnel/services/cienciaService.ts
 *
 * CRUD multi-tenant para Ciência de Responsabilidades.
 * Firestore path: `personnel/{labId}/ciencias/{id}`
 *
 * RN-06: soft-delete only (immutable after creation — no update allowed).
 * DICQ 5.1.3 + RDC 978/2025 Art. 122
 */

import {
  collection,
  db,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CienciaResponsabilidades,
  CienciaResponsabilidadesInput,
} from '../types/CienciaResponsabilidades';

type LabId = string;

// ─── Paths ──────────────────────────────────────────────────────────────────

const cienciasCol = (labId: LabId) => collection(db, 'personnel', labId, 'ciencias');

// ─── Hash generation ────────────────────────────────────────────────────────

async function generateCienciaHash(input: CienciaResponsabilidadesInput): Promise<string> {
  const canonical = [
    input.colaboradorId,
    input.cargoId,
    input.responsabilidades.join('|'),
    input.autoridades.join('|'),
    input.assinadoPorId,
    input.dataAssinatura.toMillis().toString(),
  ].join('::');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Watch (realtime) ───────────────────────────────────────────────────────

export function watchCiencias(
  labId: LabId,
  callback: (items: CienciaResponsabilidades[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    cienciasCol(labId),
    where('deletadoEm', '==', null),
    orderBy('dataAssinatura', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CienciaResponsabilidades);
      callback(items);
    },
    (err) => {
      console.error('[cienciaService] watch error:', err);
      onError?.(err);
    },
  );
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createCiencia(
  labId: LabId,
  input: CienciaResponsabilidadesInput,
): Promise<string> {
  const hash = await generateCienciaHash(input);
  const ref = doc(cienciasCol(labId));

  await setDoc(ref, {
    labId,
    colaboradorId: input.colaboradorId,
    colaboradorNome: input.colaboradorNome,
    cargoId: input.cargoId,
    cargoTitulo: input.cargoTitulo,
    responsabilidades: input.responsabilidades,
    autoridades: input.autoridades,
    dataAssinatura: input.dataAssinatura,
    assinadoPorId: input.assinadoPorId,
    testemunhaId: input.testemunhaId ?? null,
    testemunhaNome: input.testemunhaNome ?? null,
    hash,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });

  return ref.id;
}

// ─── Query: check if already signed ────────────────────────────────────────

export async function getCienciaByColaboradorCargo(
  labId: LabId,
  colaboradorId: string,
  cargoId: string,
): Promise<CienciaResponsabilidades | null> {
  const q = query(
    cienciasCol(labId),
    where('colaboradorId', '==', colaboradorId),
    where('cargoId', '==', cargoId),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...d.data() } as CienciaResponsabilidades;
}
