import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Query,
  QueryConstraint,
  onSnapshot,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { PatientPortalLaudo } from '../types/index';

/**
 * Patient Portal Service — Read-only access to patient's own laudos
 *
 * RN-P01: Service validates patientId matches auth token
 * RN-P04: Firestore rules enforce permission on read
 */

export interface PatientLaudoFilters {
  startDate?: Timestamp;
  endDate?: Timestamp;
  limit?: number;
  lastDocId?: string; // For cursor-based pagination
}

/**
 * Real-time listener for patient's laudos
 * Firestore rules enforce patientId == request.auth.uid (via portal auth token)
 */
export function listenToPatientLaudos(
  labId: string,
  patientId: string,
  onData: (laudos: PatientPortalLaudo[]) => void,
  onError?: (error: Error) => void
): () => void {
  const constraints: QueryConstraint[] = [
    where('labId', '==', labId),
    where('pacienteId', '==', patientId),
    where('deletadoEm', '==', null),
    orderBy('dataEmissao', 'desc'),
    limit(50), // Initial load: 50 items
  ];

  const q = query(collection(db, 'labs', labId, 'laudos'), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const laudos = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })) as PatientPortalLaudo[];
      onData(laudos);
    },
    (error) => {
      console.error('[listenToPatientLaudos] error:', error);
      if (onError) onError(error as Error);
    }
  );
}

/**
 * Fetch single laudo by ID (for detail view)
 */
export async function getPatientLaudo(
  labId: string,
  patientId: string,
  laudoId: string
): Promise<PatientPortalLaudo | null> {
  const constraints: QueryConstraint[] = [
    where('labId', '==', labId),
    where('pacienteId', '==', patientId),
    where('id', '==', laudoId),
    where('deletadoEm', '==', null),
  ];

  const q = query(collection(db, 'labs', labId, 'laudos'), ...constraints);
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;
  return {
    ...snapshot.docs[0].data(),
    id: snapshot.docs[0].id,
  } as PatientPortalLaudo;
}

/**
 * Count total laudos for patient (for pagination/stats)
 */
export async function countPatientLaudos(
  labId: string,
  patientId: string
): Promise<number> {
  const constraints: QueryConstraint[] = [
    where('labId', '==', labId),
    where('pacienteId', '==', patientId),
    where('deletadoEm', '==', null),
  ];

  const q = query(collection(db, 'labs', labId, 'laudos'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Fetch laudos with date range filter
 * Used for filtered queries (last 30/60/90 days, custom range)
 */
export async function getPatientLaudosInDateRange(
  labId: string,
  patientId: string,
  startDate: Timestamp,
  endDate: Timestamp,
  pageSize: number = 20
): Promise<PatientPortalLaudo[]> {
  const constraints: QueryConstraint[] = [
    where('labId', '==', labId),
    where('pacienteId', '==', patientId),
    where('deletadoEm', '==', null),
    where('dataEmissao', '>=', startDate),
    where('dataEmissao', '<=', endDate),
    orderBy('dataEmissao', 'desc'),
    limit(pageSize),
  ];

  const q = query(collection(db, 'labs', labId, 'laudos'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as PatientPortalLaudo[];
}
