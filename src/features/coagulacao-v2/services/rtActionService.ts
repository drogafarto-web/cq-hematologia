import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { RTAction, RTActionInput } from '../types/RTAction';
import { updateControlOperacional } from './controlOperacionalService';

const COLLECTION = (labId: string) => collection(db, 'labs', labId, 'rt-actions');

export async function createRTAction(
  labId: string,
  rtUid: string,
  data: RTActionInput,
): Promise<RTAction> {
  let targetRef: RTAction['targetRef'];
  if (data.tipo === 'notificar_notivisa') {
    targetRef = { type: 'Attempt', id: data.attemptId };
  } else {
    targetRef = { type: 'ControlOperacional', id: data.controlOperacionalId };
  }

  if (data.tipo === 'aprovar_controle' || data.tipo === 'rejeitar_controle') {
    const newStatus = data.tipo === 'aprovar_controle' ? 'ativo' : 'pausado';
    await updateControlOperacional(labId, data.controlOperacionalId, { status: newStatus });
  }

  const docRef = await addDoc(COLLECTION(labId), {
    labId,
    tipo: data.tipo,
    targetRef,
    payload: { tipo: data.tipo, ...data.payload },
    criadoEm: serverTimestamp(),
    criadoPor: rtUid,
  });

  return {
    id: docRef.id,
    labId,
    tipo: data.tipo,
    targetRef,
    payload: { tipo: data.tipo, ...data.payload } as RTAction['payload'],
    criadoEm: null as unknown as Timestamp,
    criadoPor: rtUid,
  };
}

export async function listRTActionsByTarget(
  labId: string,
  targetRef: { type: 'ControlOperacional' | 'Attempt'; id: string },
): Promise<RTAction[]> {
  const constraints: any[] = [
    where('targetRef.type', '==', targetRef.type),
    where('targetRef.id', '==', targetRef.id),
    orderBy('criadoEm', 'desc'),
    limit(50),
  ];
  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RTAction);
}

export async function listNotivisaPendentes(labId: string): Promise<RTAction[]> {
  const constraints: any[] = [
    where('tipo', '==', 'notificar_notivisa'),
    orderBy('criadoEm', 'desc'),
    limit(50),
  ];
  const snap = await getDocs(query(COLLECTION(labId), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RTAction);
}
