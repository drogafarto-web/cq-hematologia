import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { ControlOperacional, ControlOperacionalInput } from '../types/ControlOperacional';

const COLLECTION = (labId: string) =>
  collection(db, 'labs', labId, 'control-operacional');

export async function createControlOperacional(
  labId: string,
  data: ControlOperacionalInput,
): Promise<ControlOperacional> {
  const docRef = await addDoc(COLLECTION(labId), {
    ...data,
    status: 'ativo',
    criadoEm: serverTimestamp(),
    criadoPor: '',
    atualizadoEm: serverTimestamp(),
  });
  return {
    ...data,
    id: docRef.id,
    labId,
    status: 'ativo',
    criadoEm: null as unknown as Timestamp,
    criadoPor: '',
    atualizadoEm: null as unknown as Timestamp,
  };
}

export async function getControlOperacional(
  labId: string,
  id: string,
): Promise<ControlOperacional | null> {
  const snap = await getDoc(doc(COLLECTION(labId), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ControlOperacional;
}

export async function listControlOperacionals(
  labId: string,
  options?: { status?: ControlOperacional['status'] },
): Promise<ControlOperacional[]> {
  const constraints = [orderBy('criadoEm', 'desc'), limit(50)];
  if (options?.status) {
    constraints.unshift(where('status', '==', options.status));
  }
  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ControlOperacional));
}

export async function updateControlOperacional(
  labId: string,
  id: string,
  changes: Partial<Omit<ControlOperacionalInput, 'criadoEm' | 'criadoPor'>>,
): Promise<void> {
  await updateDoc(doc(COLLECTION(labId), id), {
    ...changes,
    atualizadoEm: serverTimestamp(),
  });
}

export async function deleteControlOperacional(
  labId: string,
  id: string,
): Promise<void> {
  await updateDoc(doc(COLLECTION(labId), id), {
    status: 'aposentado',
    atualizadoEm: serverTimestamp(),
  });
}
