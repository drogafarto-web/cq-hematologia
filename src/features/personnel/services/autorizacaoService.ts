/**
 * personnel/services/autorizacaoService.ts
 *
 * CRUD multi-tenant para Autorizações Formais.
 * Firestore path: `personnel/{labId}/autorizacoes/{id}`
 *
 * RN-06: soft-delete only.
 * DICQ 5.1.3 + RDC 978/2025 Art. 122
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
import type { AutorizacaoFormal, AutorizacaoFormalInput } from '../types/AutorizacaoFormal';

type LabId = string;

// ─── Paths ──────────────────────────────────────────────────────────────────

const autorizacoesCol = (labId: LabId) =>
  collection(db, 'personnel', labId, 'autorizacoes');

const autorizacaoDoc = (labId: LabId, id: string) =>
  doc(db, 'personnel', labId, 'autorizacoes', id);

// ─── Watch (realtime) ───────────────────────────────────────────────────────

export function watchAutorizacoes(
  labId: LabId,
  callback: (items: AutorizacaoFormal[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    autorizacoesCol(labId),
    where('deletadoEm', '==', null),
    orderBy('dataConcessao', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AutorizacaoFormal));
      callback(items);
    },
    (err) => {
      console.error('[autorizacaoService] watch error:', err);
      onError?.(err);
    },
  );
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createAutorizacao(
  labId: LabId,
  input: AutorizacaoFormalInput,
): Promise<string> {
  const ref = doc(autorizacoesCol(labId));

  await setDoc(ref, {
    labId,
    colaboradorId: input.colaboradorId,
    colaboradorNome: input.colaboradorNome,
    tipo: input.tipo,
    descricao: input.descricao,
    dataConcessao: input.dataConcessao,
    concedidoPorId: input.concedidoPorId,
    concedidoPorNome: input.concedidoPorNome,
    ativa: true,
    observacoes: input.observacoes ?? null,
    criadoEm: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletadoEm: null,
  });

  return ref.id;
}

// ─── Revogar ────────────────────────────────────────────────────────────────

export async function revogarAutorizacao(labId: LabId, id: string): Promise<void> {
  await updateDoc(autorizacaoDoc(labId, id), {
    ativa: false,
    dataRevogacao: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

// ─── Soft Delete ────────────────────────────────────────────────────────────

export async function softDeleteAutorizacao(labId: LabId, id: string): Promise<void> {
  await updateDoc(autorizacaoDoc(labId, id), {
    deletadoEm: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}
