import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Attempt, AttemptInput } from '../types/Attempt';

const COLLECTION = (labId: string) =>
  collection(db, 'labs', labId, 'attempts');

export async function saveAttempt(
  labId: string,
  operatorId: string,
  operatorDoc: string,
  data: AttemptInput & {
    conformidade: 'A' | 'R';
    violacoes: Attempt['violacoes'];
    analitosComViolacao: Attempt['analitosComViolacao'];
    snapshot: Attempt['snapshot'];
    overrides: Attempt['overrides'];
    logicalSignature: string;
  },
): Promise<Attempt> {
  const docRef = await addDoc(COLLECTION(labId), {
    ...data,
    labId,
    dataRealizacao: new Date().toISOString().split('T')[0],
    signedBy: operatorId,
    signedAt: serverTimestamp(),
    criadoEm: serverTimestamp(),
    criadoPor: operatorId,
  });
  return {
    ...data,
    id: docRef.id,
    labId,
    dataRealizacao: new Date().toISOString().split('T')[0],
    signedBy: operatorId,
    signedAt: null as unknown as Timestamp,
    criadoEm: null as unknown as Timestamp,
    criadoPor: operatorId,
  };
}

export async function getAttempt(
  labId: string,
  id: string,
): Promise<Attempt | null> {
  const snap = await getDoc(doc(COLLECTION(labId), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Attempt;
}

export async function listAttempts(
  labId: string,
  options?: {
    limit?: number;
    controlOperacionalId?: string;
    conformidade?: 'A' | 'R';
  },
): Promise<Attempt[]> {
  const constraints: any[] = [orderBy('criadoEm', 'desc')];
  if (options?.controlOperacionalId) {
    constraints.unshift(where('controlOperacionalId', '==', options.controlOperacionalId));
  }
  if (options?.conformidade) {
    constraints.unshift(where('conformidade', '==', options.conformidade));
  }
  constraints.push(limit(options?.limit ?? 50));
  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attempt));
}
