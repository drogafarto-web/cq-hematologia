import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
  doc,
  Timestamp,
  QueryConstraint,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Ata } from '../types';

/**
 * AtaService
 * Multi-tenant CRUD for meeting minutes (Atas)
 *
 * Collection path: /labs/{labId}/management-review-atas/{id}
 *
 * Key invariants:
 * - All operations are multi-tenant scoped (labId required)
 * - Soft-delete only (never deleteDoc, use deletedAt field)
 * - Can be linked to ManagementReview or standalone
 * - No business logic (validation lives in hooks/Cloud Functions)
 */

/**
 * Real-time listener for all atas of a lab
 * Filters: deletedAt == null (not soft-deleted)
 *
 * @param labId - Lab ID (tenant scope)
 * @param callback - Invoked when data changes
 * @returns Unsubscribe function
 */
export function watchAtas(
  labId: string,
  callback: (atas: Ata[]) => void
): Unsubscribe {
  const path = collection(db, 'labs', labId, 'management-review-atas');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId)
  );

  return onSnapshot(q, (snapshot) => {
    const atas: Ata[] = [];
    snapshot.forEach((doc) => {
      atas.push({
        id: doc.id,
        ...doc.data()
      } as Ata);
    });
    callback(atas);
  });
}

/**
 * Real-time listener for atas linked to a specific management review
 *
 * @param labId - Lab ID
 * @param managementReviewId - Management review ID to filter by
 * @param callback - Invoked when data changes
 * @returns Unsubscribe function
 */
export function watchAtasForReview(
  labId: string,
  managementReviewId: string,
  callback: (atas: Ata[]) => void
): Unsubscribe {
  const path = collection(db, 'labs', labId, 'management-review-atas');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId),
    where('managementReviewId', '==', managementReviewId)
  );

  return onSnapshot(q, (snapshot) => {
    const atas: Ata[] = [];
    snapshot.forEach((doc) => {
      atas.push({
        id: doc.id,
        ...doc.data()
      } as Ata);
    });
    callback(atas);
  });
}

/**
 * Fetch all atas for a lab
 * One-time read; use watchAtas for real-time
 *
 * @param labId - Lab ID
 * @returns Array of Ata
 */
export async function getAtas(labId: string): Promise<Ata[]> {
  const path = collection(db, 'labs', labId, 'management-review-atas');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId)
  );

  const snapshot = await getDocs(q);
  const atas: Ata[] = [];

  snapshot.forEach((doc) => {
    atas.push({
      id: doc.id,
      ...doc.data()
    } as Ata);
  });

  return atas;
}

/**
 * Fetch atas linked to a specific management review
 *
 * @param labId - Lab ID
 * @param managementReviewId - Management review ID
 * @returns Array of Ata linked to this review
 */
export async function getAtasForReview(
  labId: string,
  managementReviewId: string
): Promise<Ata[]> {
  const path = collection(db, 'labs', labId, 'management-review-atas');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId),
    where('managementReviewId', '==', managementReviewId)
  );

  const snapshot = await getDocs(q);
  const atas: Ata[] = [];

  snapshot.forEach((doc) => {
    atas.push({
      id: doc.id,
      ...doc.data()
    } as Ata);
  });

  return atas;
}

/**
 * Fetch single ata
 *
 * @param labId - Lab ID
 * @param ataId - Ata ID
 * @returns Ata or null if not found
 */
export async function getAta(
  labId: string,
  ataId: string
): Promise<Ata | null> {
  const docRef = doc(db, 'labs', labId, 'management-review-atas', ataId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  if (data.deletedAt !== null) {
    return null; // Soft-deleted
  }

  return {
    id: docSnap.id,
    ...data
  } as Ata;
}

/**
 * Soft-delete an ata
 * Sets deletedAt timestamp; does NOT delete the document
 * Note: This is a client-side helper; actual deletion should be via Cloud Function
 *
 * @param labId - Lab ID
 * @param ataId - Ata ID to delete
 * @param deletedAt - Timestamp of deletion (usually Timestamp.now())
 */
export function markAtaDeleted(
  labId: string,
  ataId: string,
  deletedAt: Timestamp
): void {
  // This is a marker function; actual deletion happens via CF
  console.log(
    `[AtaService] Marking ata ${ataId} as deleted at ${deletedAt.toDate().toISOString()}`
  );
}

/**
 * Helper: Map Firestore document to Ata type
 */
export function mapAtaDoc(doc: any): Ata {
  return {
    id: doc.id,
    labId: doc.labId,
    managementReviewId: doc.managementReviewId,
    dataReuniao: doc.dataReuniao,
    horaInicio: doc.horaInicio,
    horaFim: doc.horaFim,
    local: doc.local,
    pauta: doc.pauta,
    conteudo: doc.conteudo,
    participantes: doc.participantes || [],
    decisoes: doc.decisoes || [],
    assinado: doc.assinado || false,
    assinadoPor: doc.assinadoPor,
    chainHash: doc.chainHash,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt || null
  } as Ata;
}
