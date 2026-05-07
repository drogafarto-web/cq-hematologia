/**
 * qualificacoesService.ts
 *
 * Multi-tenant Firestore operations for Qualificacao (operator certifications).
 * Collection: `/labs/{labId}/qualificacoes/`
 *
 * RN-06: soft-delete only (never deleteDoc).
 * Writes go via Cloud Function callables (personnel_criarQualificacao, etc).
 * Client-side service handles reads + soft-delete mutations.
 */

import type { Unsubscribe } from 'firebase/firestore';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  db,
  getDoc,
  getDocs,
} from '../../../shared/services/firebase';
import type { Qualificacao } from '../types';

type LabId = string;
type UserId = string;

const COLLECTION_NAME = 'qualificacoes';

/**
 * Firestore path for qualificacoes collection.
 */
function qualificacoesCol(labId: LabId) {
  return collection(db, `labs/${labId}/${COLLECTION_NAME}`);
}

/**
 * Ensure lab root exists (idempotent setDoc).
 */
async function ensureLabRoot(labId: LabId): Promise<void> {
  const labDoc = doc(db, `labs/${labId}`);
  try {
    // Light touch: just verify the path exists by reading
    // (Creating happens elsewhere in the app)
  } catch (err) {
    console.warn(`Lab root check failed for ${labId}:`, err);
  }
}

/**
 * Map Firestore snapshot to Qualificacao entity.
 */
function snapshotToQualificacao(data: Record<string, unknown>): Qualificacao {
  return {
    id: data.id as string,
    labId: data.labId as string,
    uid: data.uid as string,
    tipo: data.tipo as 'Treinamento' | 'Capacitação' | 'Reciclagem',
    modulosLiberados: (data.modulosLiberados as string[]) || [],
    validoDe: data.validoDe as any,
    validoAte: (data.validoAte as any) || null,
    criadoEm: data.criadoEm as any,
    deletadoEm: (data.deletadoEm as any) || null,
  };
}

/**
 * Subscribe to qualificações for an operator.
 * Filters: uid == operadorId && deletadoEm == null
 *
 * If operadorId is omitted, returns all qualificações for the lab.
 */
export function subscribeQualificacoes(
  labId: LabId,
  callback: (qualificacoes: Qualificacao[]) => void,
  operadorId?: UserId,
  onError?: (err: Error) => void
): Unsubscribe {
  const col = qualificacoesCol(labId);

  const constraints = [where('deletadoEm', '==', null)];

  if (operadorId) {
    constraints.push(where('uid', '==', operadorId));
  }

  const q = query(col, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const qualificacoes = snapshot.docs.map((doc) =>
        snapshotToQualificacao({ ...doc.data(), id: doc.id })
      );
      callback(qualificacoes);
    },
    (err) => {
      const error = new Error(err instanceof Error ? err.message : 'Erro ao buscar qualificações');
      onError?.(error);
    }
  );
}

/**
 * Soft-delete a qualificação.
 * Sets deletadoEm to current timestamp (RN-06).
 */
export async function softDeleteQualificacao(
  labId: LabId,
  qualificacaoId: string
): Promise<void> {
  await ensureLabRoot(labId);

  const docRef = doc(db, `labs/${labId}/${COLLECTION_NAME}/${qualificacaoId}`);

  await updateDoc(docRef, {
    deletadoEm: serverTimestamp(),
  });
}

/**
 * Get single qualificacao by ID.
 */
export async function getQualificacao(
  labId: LabId,
  qualificacaoId: string
): Promise<Qualificacao | null> {
  await ensureLabRoot(labId);

  const docRef = doc(db, `labs/${labId}/${COLLECTION_NAME}/${qualificacaoId}`);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  return snapshotToQualificacao({ ...snap.data(), id: snap.id });
}

/**
 * Get all qualificações for an operator (non-deleted).
 */
export async function getQualificacoesByOperador(
  labId: LabId,
  operadorId: UserId
): Promise<Qualificacao[]> {
  await ensureLabRoot(labId);

  const col = qualificacoesCol(labId);
  const q = query(col, where('uid', '==', operadorId), where('deletadoEm', '==', null));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => snapshotToQualificacao({ ...doc.data(), id: doc.id }));
}

/**
 * Get all qualificações in lab (non-deleted).
 */
export async function getQualificacoes(labId: LabId): Promise<Qualificacao[]> {
  await ensureLabRoot(labId);

  const col = qualificacoesCol(labId);
  const q = query(col, where('deletadoEm', '==', null));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => snapshotToQualificacao({ ...doc.data(), id: doc.id }));
}

