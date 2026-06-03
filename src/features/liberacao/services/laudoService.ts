import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Query,
  QueryConstraint,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../types/_shared_refs';
import { Laudo, LaudoInput } from '../types/laudo';
import { ReleaseState } from '../types/releaseState';

/**
 * Service multi-tenant para gerenciar laudos
 * Convenção: /labs/{labId}/laudos/{laudoId}
 *
 * RN-06: soft delete only — nunca deleteDoc
 * Contratos: labId redundante em payload (validado em rules)
 */

/**
 * Filters opcionais para query de laudos
 */
export interface LaudoFilters {
  status?: ReleaseState;
  criticoFlag?: boolean;
  medicoSolicitanteId?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  limit?: number;
}

/**
 * Subscribe a laudos em tempo real com filtros
 *
 * @param labId ID do lab
 * @param filters Filtros opcionais
 * @param onData Callback com lista de laudos
 * @param onError Callback de erro
 * @returns Unsubscribe function
 */
export function subscribeLaudos(
  labId: LabId,
  filters: LaudoFilters = {},
  onData: (laudos: Laudo[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
  ];

  // Aplica filtros opcionais
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.criticoFlag !== undefined) {
    constraints.push(where('criticoFlag', '==', filters.criticoFlag));
  }

  if (filters.medicoSolicitanteId) {
    constraints.push(where('medicoSolicitanteId', '==', filters.medicoSolicitanteId));
  }

  if (filters.startDate) {
    constraints.push(where('criadoEm', '>=', filters.startDate));
  }

  if (filters.endDate) {
    constraints.push(where('criadoEm', '<=', filters.endDate));
  }

  constraints.push(orderBy('criadoEm', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, 'labs', labId, 'laudos'), ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const laudos = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as Laudo[];
      onData(laudos);
    },
    (error) => {
      console.error('[subscribeLaudos] error:', error);
      onError?.(error);
    },
  );

  return unsubscribe;
}

/**
 * Get laudo por ID (uma vez)
 */
export async function getLaudo(labId: LabId, laudoId: string): Promise<Laudo | null> {
  const docRef = doc(db, 'labs', labId, 'laudos', laudoId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...snapshot.data(),
    id: snapshot.id,
  } as Laudo;
}

/**
 * Get versão mais recente de um laudo
 * Consulta /laudos/{laudoId}/versions ordenado por version DESC
 */
export async function getLaudoLatestVersion(labId: LabId, laudoId: string): Promise<any | null> {
  const q = query(
    collection(db, 'labs', labId, 'laudo-versions'),
    where('laudoId', '==', laudoId),
    orderBy('version', 'desc'),
    limit(1),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    ...doc.data(),
    id: doc.id,
  };
}

/**
 * Soft delete — marca deletadoEm em vez de remover
 * Implementado em Cloud Function no Plan 10-02+ para validação server-side
 */
export async function softDeleteLaudo(labId: LabId, laudoId: string): Promise<void> {
  const docRef = doc(db, 'labs', labId, 'laudos', laudoId);
  await updateDoc(docRef, {
    deletadoEm: Timestamp.now(),
  });
}
