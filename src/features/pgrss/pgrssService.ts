import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import type { RegistroGeracao, ColletaResiduo } from './types/PGRSS';

const geracaoCollection = (labId: string) => collection(db, `labs/${labId}/pgrss-geracao`);
const coletaCollection = (labId: string) => collection(db, `labs/${labId}/pgrss-coleta`);

export function subscribeGeracoes(
  labId: string,
  callback: (registros: RegistroGeracao[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(geracaoCollection(labId), where('deletadoEm', '==', null), orderBy('data', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const registros = snap.docs.map((d) => d.data() as RegistroGeracao);
      callback(registros);
    },
    onError,
  );
}

export function subscribeColetas(
  labId: string,
  callback: (coletas: ColletaResiduo[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(coletaCollection(labId), orderBy('data', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const coletas = snap.docs.map((d) => d.data() as ColletaResiduo);
      callback(coletas);
    },
    onError,
  );
}

export async function createGeracao(
  labId: string,
  input: Omit<RegistroGeracao, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>,
): Promise<string> {
  const newDocRef = doc(geracaoCollection(labId));

  const data: RegistroGeracao = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: 'system',
    deletadoEm: null,
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

export async function createColeta(
  labId: string,
  input: Omit<ColletaResiduo, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>,
): Promise<string> {
  const newDocRef = doc(coletaCollection(labId));

  const data: ColletaResiduo = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: 'system',
  };

  await setDoc(newDocRef, data);
  return newDocRef.id;
}

export async function updateGeracao(labId: string, id: string, updates: Partial<RegistroGeracao>): Promise<void> {
  const docRef = doc(geracaoCollection(labId), id);
  const { id: _, labId: __, criadoEm, criadoPor, deletadoEm, ...safeUpdates } = updates;
  await updateDoc(docRef, safeUpdates);
}

export async function softDeleteGeracao(labId: string, id: string): Promise<void> {
  const docRef = doc(geracaoCollection(labId), id);
  await updateDoc(docRef, { deletadoEm: serverTimestamp() });
}
