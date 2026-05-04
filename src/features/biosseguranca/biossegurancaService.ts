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
import type { Area, EPE, InspecaoArea, BiossegurancaFilters } from './types/Biosseguranca';

const areasCollection = (labId: string) => collection(db, `labs/${labId}/biosseguranca-areas`);
const epeCollection = (labId: string) => collection(db, `labs/${labId}/biosseguranca-epe`);
const inspecoesCollection = (labId: string) => collection(db, `labs/${labId}/biosseguranca-inspecoes`);

// ─── Subscribe Areas ──────────────────────────────────────────────────────

export function subscribeAreas(
  labId: string,
  filters: BiossegurancaFilters = {},
  callback: (areas: Area[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const whereConstraints = [where('deletadoEm', '==', null)];

  if (filters.status) {
    whereConstraints.push(where('status', '==', filters.status));
  }

  if (filters.nivelMinimo) {
    whereConstraints.push(where('nivelBiosseguranca', '>=', filters.nivelMinimo));
  }

  const q = query(areasCollection(labId), ...whereConstraints, orderBy('nome', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const areas = snap.docs.map((d) => d.data() as Area);
      callback(areas);
    },
    onError,
  );
}

// ─── Subscribe EPEs ───────────────────────────────────────────────────────

export function subscribeEPEs(
  labId: string,
  callback: (epes: EPE[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(epeCollection(labId), where('deletadoEm', '==', null), orderBy('tipo', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const epes = snap.docs.map((d) => d.data() as EPE);
      callback(epes);
    },
    onError,
  );
}

// ─── Subscribe Inspecoes ──────────────────────────────────────────────────

export function subscribeInspecoes(
  labId: string,
  areaId?: string,
  callback?: (inspecoes: InspecaoArea[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  let q = query(inspecoesCollection(labId), orderBy('data', 'desc'));

  if (areaId) {
    q = query(inspecoesCollection(labId), where('areaId', '==', areaId), orderBy('data', 'desc'));
  }

  return onSnapshot(
    q,
    (snap) => {
      const inspecoes = snap.docs.map((d) => d.data() as InspecaoArea);
      callback?.(inspecoes);
    },
    onError,
  );
}

// ─── Get single Area ──────────────────────────────────────────────────────

export async function getArea(labId: string, areaId: string): Promise<Area | null> {
  const docRef = doc(areasCollection(labId), areaId);
  const snap = await getDocs(query(areasCollection(labId), where('id', '==', areaId)));
  return snap.empty ? null : (snap.docs[0].data() as Area);
}

// ─── Create Area ──────────────────────────────────────────────────────────

export async function createArea(labId: string, input: Omit<Area, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>): Promise<string> {
  const newDocRef = doc(areasCollection(labId));

  const areaData: Area = {
    id: newDocRef.id,
    labId,
    ...input,
    pessoasAtuais: input.pessoasAtuais ?? 0,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: 'system', // Should be replaced by Cloud Function with request.auth.uid
    deletadoEm: null,
  };

  await setDoc(newDocRef, areaData);
  return newDocRef.id;
}

// ─── Update Area ──────────────────────────────────────────────────────────

export async function updateArea(labId: string, areaId: string, updates: Partial<Area>): Promise<void> {
  const docRef = doc(areasCollection(labId), areaId);
  const { id, labId: _, criadoEm, criadoPor, deletadoEm, ...safeUpdates } = updates;

  await updateDoc(docRef, safeUpdates);
}

// ─── Create EPE ───────────────────────────────────────────────────────────

export async function createEPE(labId: string, input: Omit<EPE, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'deletadoEm'>): Promise<string> {
  const newDocRef = doc(epeCollection(labId));

  const epeData: EPE = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: 'system',
    deletadoEm: null,
  };

  await setDoc(newDocRef, epeData);
  return newDocRef.id;
}

// ─── Update EPE stock ────────────────────────────────────────────────────

export async function updateEPEStock(labId: string, epeId: string, novaQtd: number): Promise<void> {
  const docRef = doc(epeCollection(labId), epeId);
  await updateDoc(docRef, { qtdEstoque: novaQtd });
}

// ─── Create Inspecao ──────────────────────────────────────────────────────

export async function createInspecao(
  labId: string,
  input: Omit<InspecaoArea, 'id' | 'labId' | 'criadoEm' | 'criadoPor'>,
): Promise<string> {
  const newDocRef = doc(inspecoesCollection(labId));

  const inspecaoData: InspecaoArea = {
    id: newDocRef.id,
    labId,
    ...input,
    criadoEm: serverTimestamp() as Timestamp,
    criadoPor: 'system',
  };

  await setDoc(newDocRef, inspecaoData);
  return newDocRef.id;
}

// ─── Get EPEs for area ────────────────────────────────────────────────────

export async function getEPEsObrigatorios(labId: string, areaId: string): Promise<EPE[]> {
  const area = await getArea(labId, areaId);
  if (!area) return [];

  const snap = await getDocs(epeCollection(labId));
  const allEPEs = snap.docs.map((d) => d.data() as EPE);

  return allEPEs.filter((epe) => area.epeObrigatorio.includes(epe.tipo));
}

// ─── Soft delete ──────────────────────────────────────────────────────────

export async function softDeleteArea(labId: string, areaId: string): Promise<void> {
  const docRef = doc(areasCollection(labId), areaId);
  await updateDoc(docRef, { deletadoEm: serverTimestamp() });
}

export async function softDeleteEPE(labId: string, epeId: string): Promise<void> {
  const docRef = doc(epeCollection(labId), epeId);
  await updateDoc(docRef, { deletadoEm: serverTimestamp() });
}
