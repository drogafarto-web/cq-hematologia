import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  Timestamp,
  type Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { POP, POPInput, POPFilters } from '../types/POP';

const popsCollection = (labId: string) => collection(db, `labs/${labId}/pops`);

// ─── Subscribe ─────────────────────────────────────────────────────────────

export function subscribePOPs(
  labId: string,
  filters: POPFilters = {},
  callback: (pops: POP[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints = [where('deletadoEm', '==', null)];

  if (filters.modulo) {
    const modulos = Array.isArray(filters.modulo) ? filters.modulo : [filters.modulo];
    constraints.push(where('modulos', 'array-contains-any', modulos));
  }

  const q = query(popsCollection(labId), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const pops = snap.docs
        .map((d) => d.data() as POP)
        .filter((pop) => {
          if (filters.status) {
            const versaoAtiva = pop.versoes?.find((v) => v.status === 'ativa');
            if (!versaoAtiva) return false;
          }
          if (filters.busca) {
            const search = filters.busca.toLowerCase();
            return (
              pop.nome.toLowerCase().includes(search) ||
              pop.codigo.toLowerCase().includes(search)
            );
          }
          return true;
        });
      callback(pops);
    },
    onError,
  );
}

// ─── Get single POP ────────────────────────────────────────────────────────

export async function getPOP(labId: string, popId: string): Promise<POP | null> {
  const docRef = doc(popsCollection(labId), popId);
  const snap = await getDocs(query(popsCollection(labId), where('id', '==', popId)));
  return snap.empty ? null : (snap.docs[0].data() as POP);
}

// ─── Create POP (thin wrapper — actual callable is in Cloud Functions) ─────

export async function createPOPClient(labId: string, input: POPInput): Promise<string> {
  const newRef = doc(popsCollection(labId));

  const pop: POP = {
    ...input,
    id: newRef.id,
    labId,
    versoes: [],
    criadoEm: Timestamp.now(),
    criadoPor: '', // Set by callable
    deletadoEm: null,
  };

  await setDoc(newRef, pop);
  return newRef.id;
}

// ─── Update POP ────────────────────────────────────────────────────────────

export async function updatePOP(
  labId: string,
  popId: string,
  updates: Partial<Omit<POP, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>>,
): Promise<void> {
  const docRef = doc(popsCollection(labId), popId);
  await updateDoc(docRef, updates);
}

// ─── Soft delete ───────────────────────────────────────────────────────────

export async function softDeletePOP(labId: string, popId: string): Promise<void> {
  const docRef = doc(popsCollection(labId), popId);
  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}

// ─── Search POPs by codigo ────────────────────────────────────────────────

export async function searchPOPByCode(
  labId: string,
  codigo: string,
): Promise<POP | null> {
  const q = query(
    popsCollection(labId),
    where('codigo', '==', codigo),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as POP);
}

// ─── Get POPs by modulo ────────────────────────────────────────────────────

export async function getPOPsByModulo(labId: string, modulo: string): Promise<POP[]> {
  const q = query(
    popsCollection(labId),
    where('modulos', 'array-contains', modulo),
    where('deletadoEm', '==', null),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as POP);
}
