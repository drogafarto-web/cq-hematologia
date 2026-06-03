/**
 * Reclamacao Service Layer
 *
 * Thin service: CRUD operations + Firestore snapshot mapping.
 * Validations, RCA engine, and state transitions live in hooks (fat hooks pattern).
 *
 * Multi-tenant: all operations scoped to `/labs/{labId}/reclamacoes/`
 * Soft-delete only (RN-06): never call deleteDoc, use softDelete
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
  Timestamp,
  type QueryConstraint,
  type Unsubscribe,
  type DocumentSnapshot,
  type Query,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { Reclamacao, CreateReclamacaoInput, StatusReclamacao } from '../types';

/**
 * Subscribe to all complaints for a lab
 * Returns unsubscribe function (call in useEffect cleanup)
 */
export function subscribeToReclamacoes(
  labId: string,
  filters?: {
    status?: StatusReclamacao;
    responsavelId?: string;
    limit?: number;
  },
  onUpdate?: (reclamacoes: Reclamacao[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const constraints: any[] = [
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters?.responsavelId) {
    constraints.push(where('responsavelId', '==', filters.responsavelId));
  }

  if (filters?.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, 'labs', labId, 'reclamacoes'), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const reclamacoes: Reclamacao[] = [];
      snapshot.forEach((doc) => {
        reclamacoes.push(doc.data() as Reclamacao);
      });
      onUpdate?.(reclamacoes);
    },
    (error) => {
      console.error('Error subscribing to reclamacoes:', error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to single complaint by ID
 */
export function subscribeToReclamacao(
  labId: string,
  reclamacaoId: string,
  onUpdate?: (reclamacao: Reclamacao | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const docRef = doc(db, 'labs', labId, 'reclamacoes', reclamacaoId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate?.(snapshot.data() as Reclamacao);
      } else {
        onUpdate?.(null);
      }
    },
    (error) => {
      console.error('Error subscribing to reclamacao:', error);
      onError?.(error as Error);
    },
  );
}

/**
 * Get single complaint (one-time read)
 */
export async function getReclamacao(
  labId: string,
  reclamacaoId: string,
): Promise<Reclamacao | null> {
  const docRef = doc(db, 'labs', labId, 'reclamacoes', reclamacaoId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data() as Reclamacao;
  }

  return null;
}

/**
 * Get complaints by status (batch read)
 */
export async function getReclamacoesByStatus(
  labId: string,
  status: StatusReclamacao,
  limitCount = 100,
): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('status', '==', status),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];

  snapshot.forEach((doc) => {
    reclamacoes.push(doc.data() as Reclamacao);
  });

  return reclamacoes;
}

/**
 * Get complaints by severity (for trending dashboard)
 */
export async function getReclamacoesBySeveridade(
  labId: string,
  severidade: 'alta' | 'media' | 'baixa',
  limitCount = 100,
): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('classificacao.severidade', '==', severidade),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];

  snapshot.forEach((doc) => {
    reclamacoes.push(doc.data() as Reclamacao);
  });

  return reclamacoes;
}

/**
 * Get complaints by responsible area (pre-ana, analytic, post-ana, etc.)
 */
export async function getReclamacoesByArea(
  labId: string,
  area: string,
  limitCount = 100,
): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('classificacao.areaResponsavel', '==', area),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];

  snapshot.forEach((doc) => {
    reclamacoes.push(doc.data() as Reclamacao);
  });

  return reclamacoes;
}

/**
 * Search complaints by description text (simple substring match)
 * NOTE: For production, use Firestore Full Text Search or Algolia
 */
export async function searchReclamacoes(
  labId: string,
  searchTerm: string,
  limitCount = 50,
): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    orderBy('criadoEm', 'desc'),
    limit(limitCount * 2), // fetch 2x to filter client-side
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];
  const searchLower = searchTerm.toLowerCase();

  snapshot.forEach((doc) => {
    const complaint = doc.data() as Reclamacao;
    if (
      complaint.descricao.toLowerCase().includes(searchLower) ||
      complaint.reclamante.nome.toLowerCase().includes(searchLower) ||
      complaint.reclamante.cpf.includes(searchTerm)
    ) {
      reclamacoes.push(complaint);
    }
  });

  return reclamacoes.slice(0, limitCount);
}

/**
 * Get complaints by date range (for reporting)
 */
export async function getReclamacoesByDateRange(
  labId: string,
  startDate: Date,
  endDate: Date,
  limitCount = 500,
): Promise<Reclamacao[]> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    where('criadoEm', '>=', Timestamp.fromDate(startDate)),
    where('criadoEm', '<=', Timestamp.fromDate(endDate)),
    orderBy('criadoEm', 'desc'),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];

  snapshot.forEach((doc) => {
    reclamacoes.push(doc.data() as Reclamacao);
  });

  return reclamacoes;
}

/**
 * Soft-delete complaint (mark as deleted, preserve audit trail)
 * This is a client helper; actual deletion happens via Cloud Function (Plan 11-03)
 */
export async function markReclamacaoAsDeleted(
  labId: string,
  reclamacaoId: string,
): Promise<boolean> {
  // Service doesn't actually perform the deletion
  // (requires signature + transaction in hook/function)
  console.warn('markReclamacaoAsDeleted: soft-delete must be called from hook with signature');
  return false;
}

/**
 * Get complaints with overdue SLA (slaPrazo < now)
 */
export async function getOverdueReclamacoes(labId: string): Promise<Reclamacao[]> {
  const now = Timestamp.now();

  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('deletadoEm', '==', null),
    where('slaPrazo', '<', now),
    where('status', 'in', ['Nova', 'Analisando', 'RCA']),
    orderBy('slaPrazo', 'asc'),
  );

  const snapshot = await getDocs(q);
  const reclamacoes: Reclamacao[] = [];

  snapshot.forEach((doc) => {
    reclamacoes.push(doc.data() as Reclamacao);
  });

  return reclamacoes;
}

/**
 * Get complaints pending RCA (status = 'RCA')
 */
export async function getReclamacoesPendentesRCA(
  labId: string,
  limitCount = 100,
): Promise<Reclamacao[]> {
  return getReclamacoesByStatus(labId, 'RCA', limitCount);
}

/**
 * Count complaints by status (for dashboard KPI)
 */
export async function countReclamacoesByStatus(
  labId: string,
  status: StatusReclamacao,
): Promise<number> {
  const q = query(
    collection(db, 'labs', labId, 'reclamacoes'),
    where('labId', '==', labId),
    where('status', '==', status),
    where('deletadoEm', '==', null),
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
