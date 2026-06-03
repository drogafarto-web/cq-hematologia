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
import type { Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Attempt, AttemptInput } from '../types/Attempt';

const COLLECTION = (labId: string) => collection(db, 'labs', labId, 'attempts');

export async function saveAttempt(
  labId: string,
  operatorId: string,
  operatorUid: string,
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
    acaoCorretiva: data.acaoCorretiva ?? null,
    labId,
    dataRealizacao: new Date().toISOString().split('T')[0],
    signedBy: operatorUid,
    signedAt: serverTimestamp(),
    criadoEm: serverTimestamp(),
    criadoPor: operatorUid,
  });
  return {
    ...data,
    acaoCorretiva: data.acaoCorretiva ?? null,
    id: docRef.id,
    labId,
    dataRealizacao: new Date().toISOString().split('T')[0],
    signedBy: operatorUid,
    signedAt: null as unknown as Timestamp,
    criadoEm: null as unknown as Timestamp,
    criadoPor: operatorUid,
  };
}

export async function getAttempt(labId: string, id: string): Promise<Attempt | null> {
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
  const constraints: any[] = [];
  if (options?.controlOperacionalId) {
    constraints.push(where('controlOperacionalId', '==', options.controlOperacionalId));
  }
  if (options?.conformidade) {
    constraints.push(where('conformidade', '==', options.conformidade));
  }
  constraints.push(orderBy('criadoEm', 'desc'));
  constraints.push(limit(options?.limit ?? 50));
  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Attempt);
}
