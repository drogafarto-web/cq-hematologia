/**
 * fornecedorService — CRUD do catálogo de fornecedores do lab.
 *
 * Path: /labs/{labId}/fornecedores/{fornecedorId}
 *
 * Regra forte: CNPJ é único por lab. Tentativa de cadastro com CNPJ já
 * existente resolve pro fornecedor existente (pattern "upsert read-only")
 * — o caller decide se mostra "já existia".
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
  deleteField,
  serverTimestamp,
  Timestamp,
  firestoreErrorMessage,
} from '../../../shared/services/firebase';
import type { Unsubscribe } from '../../../shared/services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants';
import type { Fornecedor } from '../types/Fornecedor';
import { normalizeCnpj, isValidCnpj } from '../types/Fornecedor';

// ─── Path helpers ────────────────────────────────────────────────────────────

function fornecedoresCol(labId: string) {
  return collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.FORNECEDORES);
}

function fornecedorRef(labId: string, fornecedorId: string) {
  return doc(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.FORNECEDORES, fornecedorId);
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export type CreateFornecedorPayload = Omit<
  Fornecedor,
  'id' | 'labId' | 'createdAt' | 'ativo' | 'createdBy'
> & {
  createdBy: string;
};

export type UpdateFornecedorPayload = {
  razaoSocial?: string;
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
  updatedBy: string;
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface FornecedorFilters {
  ativo?: boolean;
  /** Busca textual cliente-side: razaoSocial + nomeFantasia + cnpj. */
  query?: string;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export function subscribeToFornecedores(
  labId: string,
  onData: (fornecedores: Fornecedor[]) => void,
  onError: (err: Error) => void,
  filters: FornecedorFilters = {},
): Unsubscribe {
  const constraints = [];
  if (typeof filters.ativo === 'boolean') {
    constraints.push(where('ativo', '==', filters.ativo));
  }
  constraints.push(orderBy('razaoSocial', 'asc'));

  const q = query(fornecedoresCol(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Fornecedor, 'id'>) }) as Fornecedor,
      );
      onData(filters.query ? filterByText(list, filters.query) : list);
    },
    (err) => onError(new Error(firestoreErrorMessage(err), { cause: err })),
  );
}

function filterByText(list: Fornecedor[], needle: string): Fornecedor[] {
  const q = needle.toLowerCase().trim();
  const qDigits = normalizeCnpj(q);
  return list.filter(
    (f) =>
      f.razaoSocial.toLowerCase().includes(q) ||
      (f.nomeFantasia ?? '').toLowerCase().includes(q) ||
      (qDigits.length > 0 && f.cnpj.includes(qDigits)),
  );
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Cria fornecedor — valida CNPJ (módulo 11 + único no lab). Se CNPJ já
 * existe, retorna o existente com flag `wasDuplicate=true`.
 */
export async function createFornecedor(
  labId: string,
  payload: CreateFornecedorPayload,
): Promise<{ id: string; wasDuplicate: boolean }> {
  const cnpj = normalizeCnpj(payload.cnpj);
  if (!isValidCnpj(cnpj)) {
    throw new Error('CNPJ inválido.');
  }

  try {
    // Dedup por CNPJ no lab
    const existing = await findFornecedorByCnpj(labId, cnpj);
    if (existing) {
      return { id: existing.id, wasDuplicate: true };
    }

    const id = crypto.randomUUID();
    const newDoc: Omit<Fornecedor, 'id'> = {
      labId,
      razaoSocial: payload.razaoSocial.trim(),
      ...(payload.nomeFantasia?.trim() && { nomeFantasia: payload.nomeFantasia.trim() }),
      cnpj,
      ...(payload.inscricaoEstadual?.trim() && {
        inscricaoEstadual: payload.inscricaoEstadual.trim(),
      }),
      ...(payload.telefone?.trim() && { telefone: payload.telefone.trim() }),
      ...(payload.email?.trim() && { email: payload.email.trim() }),
      ...(payload.endereco?.trim() && { endereco: payload.endereco.trim() }),
      ...(payload.observacoes?.trim() && { observacoes: payload.observacoes.trim() }),
      ativo: true,
      createdAt: Timestamp.now(),
      createdBy: payload.createdBy,
    };

    await setDoc(fornecedorRef(labId, id), newDoc);
    return { id, wasDuplicate: false };
  } catch (err) {
    if (err instanceof Error && err.message === 'CNPJ inválido.') throw err;
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function updateFornecedor(
  labId: string,
  fornecedorId: string,
  patch: UpdateFornecedorPayload,
): Promise<void> {
  try {
    const { updatedBy, ...fields } = patch;
    const update: Record<string, unknown> = {
      updatedBy,
      updatedAt: serverTimestamp(),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      update[k] = v === null ? deleteField() : typeof v === 'string' ? v.trim() : v;
    }
    await updateDoc(fornecedorRef(labId, fornecedorId), update);
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Soft-delete — só marca inativo. Hard-delete (abaixo) só permitido pelo
 * caller quando `countNotasByFornecedor === 0`.
 */
export async function deactivateFornecedor(
  labId: string,
  fornecedorId: string,
  updatedBy: string,
): Promise<void> {
  try {
    await updateDoc(fornecedorRef(labId, fornecedorId), {
      ativo: false,
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function reactivateFornecedor(
  labId: string,
  fornecedorId: string,
  updatedBy: string,
): Promise<void> {
  try {
    await updateDoc(fornecedorRef(labId, fornecedorId), {
      ativo: true,
      updatedBy,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function deleteFornecedor(labId: string, fornecedorId: string): Promise<void> {
  try {
    await deleteDoc(fornecedorRef(labId, fornecedorId));
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getFornecedorOnce(
  labId: string,
  fornecedorId: string,
): Promise<Fornecedor | null> {
  try {
    const snap = await getDoc(fornecedorRef(labId, fornecedorId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Fornecedor, 'id'>) } as Fornecedor;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

export async function findFornecedorByCnpj(
  labId: string,
  cnpj: string,
): Promise<Fornecedor | null> {
  const cnpjNorm = normalizeCnpj(cnpj);
  try {
    const q = query(fornecedoresCol(labId), where('cnpj', '==', cnpjNorm));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Fornecedor, 'id'>) } as Fornecedor;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}

/**
 * Conta notas fiscais vinculadas ao fornecedor. Usado como gate pra permitir
 * hard-delete (só quando == 0).
 */
export async function countNotasByFornecedor(
  labId: string,
  fornecedorId: string,
): Promise<number> {
  try {
    const notasCol = collection(db, COLLECTIONS.LABS, labId, SUBCOLLECTIONS.NOTAS_FISCAIS);
    const q = query(notasCol, where('fornecedorId', '==', fornecedorId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    throw new Error(firestoreErrorMessage(err), { cause: err });
  }
}
