/**
 * notaFiscalService — CRUD das notas fiscais de entrada de insumos.
 *
 * Path: /labs/{labId}/notas-fiscais/{notaId}
 *
 * Referência: RDC 786/2023 art. 42 — rastreabilidade fiscal é obrigatória
 * em insumos de diagnóstico. A nota agrega N lotes (Insumo.notaFiscalId).
 */

import {
  db,
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { NotaFiscal } from '../types/NotaFiscal';

function notasCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.NOTAS_FISCAIS);
}

function notaRef(labId: string, notaId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.NOTAS_FISCAIS, notaId);
}

export type CreateNotaFiscalPayload = Omit<NotaFiscal, 'id' | 'labId' | 'createdAt' | 'createdBy'> & {
  createdBy: string;
};

export interface NotaFiscalFilters {
  fornecedorId?: string;
  /** Busca textual no numero + chaveAcesso. */
  query?: string;
}

export function subscribeToNotasFiscais(
  labId: string,
  onData: (notas: NotaFiscal[]) => void,
  onError: (err: Error) => void,
  filters: NotaFiscalFilters = {},
): Unsubscribe {
  const constraints = [];
  if (filters.fornecedorId) {
    constraints.push(where('fornecedorId', '==', filters.fornecedorId));
  }
  constraints.push(orderBy('dataEmissao', 'desc'));

  const q = query(notasCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<NotaFiscal, 'id'>) }) as NotaFiscal,
      );
      onData(filters.query ? filterByText(list, filters.query) : list);
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

function filterByText(list: NotaFiscal[], needle: string): NotaFiscal[] {
  const q = needle.toLowerCase().trim();
  const qDigits = q.replace(/\D/g, '');
  return list.filter(
    (n) =>
      n.numero.toLowerCase().includes(q) ||
      (qDigits.length > 0 && (n.chaveAcesso ?? '').includes(qDigits)),
  );
}

export async function createNotaFiscal(
  labId: string,
  payload: CreateNotaFiscalPayload,
): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const newDoc: Omit<NotaFiscal, 'id'> = {
      labId,
      fornecedorId: payload.fornecedorId,
      numero: payload.numero.trim(),
      ...(payload.serie?.trim() && { serie: payload.serie.trim() }),
      ...(payload.chaveAcesso && { chaveAcesso: payload.chaveAcesso.replace(/\D/g, '') }),
      dataEmissao: payload.dataEmissao,
      dataRecebimento: payload.dataRecebimento,
      ...(typeof payload.valorTotal === 'number' && { valorTotal: payload.valorTotal }),
      ...(payload.arquivoPdfUrl && { arquivoPdfUrl: payload.arquivoPdfUrl }),
      ...(payload.observacoes?.trim() && { observacoes: payload.observacoes.trim() }),
      createdAt: Timestamp.now(),
      createdBy: payload.createdBy,
    };

    await setDoc(notaRef(labId, id), newDoc);
    return id;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateNotaFiscal(
  labId: string,
  notaId: string,
  patch: Partial<Omit<NotaFiscal, 'id' | 'labId' | 'createdAt' | 'createdBy'>> & {
    updatedBy: string;
  },
): Promise<void> {
  try {
    await updateDoc(notaRef(labId, notaId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function deleteNotaFiscal(labId: string, notaId: string): Promise<void> {
  try {
    await deleteDoc(notaRef(labId, notaId));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function getNotaFiscalOnce(
  labId: string,
  notaId: string,
): Promise<NotaFiscal | null> {
  try {
    const snap = await getDoc(notaRef(labId, notaId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<NotaFiscal, 'id'>) } as NotaFiscal;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Conta lotes (Insumos) vinculados à nota fiscal — gate antes de delete.
 */
export async function countInsumosByNota(
  labId: string,
  notaId: string,
): Promise<number> {
  try {
    const insumosCol = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.INSUMOS);
    const q = query(insumosCol, where('notaFiscalId', '==', notaId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
