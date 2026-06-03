/**
 * Sugestao Service Layer
 *
 * Suggestion module service: CRUD + subscription.
 * Simpler than complaints (no RCA, no NC link).
 * Multi-tenant: `/labs/{labId}/sugestoes/`
 */

import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { Sugestao, StatusSugestao } from '../types';

/**
 * Subscribe to all suggestions for a lab
 */
export function subscribeToSugestoes(
  labId: string,
  filters?: {
    status?: StatusSugestao;
    limit?: number;
  },
  onUpdate?: (sugestoes: Sugestao[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const constraints: any[] = [
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    orderBy('votos', 'desc'),
    orderBy('criadoEm', 'desc'),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters?.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, 'labs', labId, 'sugestoes'), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const sugestoes: Sugestao[] = [];
      snapshot.forEach((doc) => {
        sugestoes.push(doc.data() as Sugestao);
      });
      onUpdate?.(sugestoes);
    },
    (error) => {
      console.error('Error subscribing to sugestoes:', error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to single suggestion
 */
export function subscribeToSugestao(
  labId: string,
  sugestaoId: string,
  onUpdate?: (sugestao: Sugestao | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const docRef = doc(db, 'labs', labId, 'sugestoes', sugestaoId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate?.(snapshot.data() as Sugestao);
      } else {
        onUpdate?.(null);
      }
    },
    (error) => {
      console.error('Error subscribing to sugestao:', error);
      onError?.(error as Error);
    },
  );
}

/**
 * Get single suggestion (one-time read)
 */
export async function getSugestao(labId: string, sugestaoId: string): Promise<Sugestao | null> {
  const docRef = doc(db, 'labs', labId, 'sugestoes', sugestaoId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data() as Sugestao;
  }

  return null;
}

/**
 * Get suggestions by status
 */
export async function getSugestoesByStatus(
  labId: string,
  status: StatusSugestao,
  limitCount = 100,
): Promise<Sugestao[]> {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('status', '==', status),
    where('deletadoEm', '==', null),
    orderBy('votos', 'desc'),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const sugestoes: Sugestao[] = [];

  snapshot.forEach((doc) => {
    sugestoes.push(doc.data() as Sugestao);
  });

  return sugestoes;
}

/**
 * Get suggestions by category
 */
export async function getSugestoesByCategoria(
  labId: string,
  categoria: string,
  limitCount = 100,
): Promise<Sugestao[]> {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('categoria', '==', categoria),
    where('deletadoEm', '==', null),
    orderBy('votos', 'desc'),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const sugestoes: Sugestao[] = [];

  snapshot.forEach((doc) => {
    sugestoes.push(doc.data() as Sugestao);
  });

  return sugestoes;
}

/**
 * Get top-voted suggestions (community features)
 */
export async function getTopVotedSugestoes(labId: string, limitCount = 20): Promise<Sugestao[]> {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    orderBy('votos', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const sugestoes: Sugestao[] = [];

  snapshot.forEach((doc) => {
    sugestoes.push(doc.data() as Sugestao);
  });

  return sugestoes;
}

/**
 * Get suggestions by author
 */
export async function getSugestoesByAutor(
  labId: string,
  autorId: string,
  limitCount = 50,
): Promise<Sugestao[]> {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('autorId', '==', autorId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const sugestoes: Sugestao[] = [];

  snapshot.forEach((doc) => {
    sugestoes.push(doc.data() as Sugestao);
  });

  return sugestoes;
}

/**
 * Count suggestions by status
 */
export async function countSugestoesByStatus(
  labId: string,
  status: StatusSugestao,
): Promise<number> {
  const q = query(
    collection(db, 'labs', labId, 'sugestoes'),
    where('labId', '==', labId),
    where('status', '==', status),
    where('deletadoEm', '==', null),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
