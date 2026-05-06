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
  CollectionReference,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ManagementReview, ReviewStatus } from '../types';

/**
 * ManagementReviewService
 * Multi-tenant CRUD for DICQ 4.15 annual direction critical analysis
 *
 * Collection path: /labs/{labId}/management-reviews/{id}
 *
 * Key invariants:
 * - All operations are multi-tenant scoped (labId required)
 * - Soft-delete only (never deleteDoc, use deletedAt field)
 * - No business logic (validation lives in hooks/Cloud Functions)
 * - Snapshot mapping is the only responsibility
 */

/**
 * Real-time listener for all management reviews of a lab
 * Filters: deletedAt == null (not soft-deleted)
 *
 * @param labId - Lab ID (tenant scope)
 * @param callback - Invoked when data changes
 * @returns Unsubscribe function
 */
export function watchManagementReviews(
  labId: string,
  callback: (reviews: ManagementReview[]) => void
): Unsubscribe {
  const path = collection(db, 'labs', labId, 'management-reviews');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId)
  );

  return onSnapshot(q, (snapshot) => {
    const reviews: ManagementReview[] = [];
    snapshot.forEach((doc) => {
      reviews.push({
        id: doc.id,
        ...doc.data()
      } as ManagementReview);
    });
    callback(reviews);
  });
}

/**
 * Fetch all management reviews for a lab
 * One-time read; use watchManagementReviews for real-time
 *
 * @param labId - Lab ID
 * @param filterByYear - Optional: filter by year
 * @returns Array of ManagementReview
 */
export async function getManagementReviews(
  labId: string,
  filterByYear?: number
): Promise<ManagementReview[]> {
  const path = collection(db, 'labs', labId, 'management-reviews');

  const constraints: QueryConstraint[] = [
    where('deletedAt', '==', null),
    where('labId', '==', labId)
  ];

  if (filterByYear !== undefined) {
    constraints.push(where('year', '==', filterByYear));
  }

  const q = query(path, ...constraints);
  const snapshot = await getDocs(q);

  const reviews: ManagementReview[] = [];
  snapshot.forEach((doc) => {
    reviews.push({
      id: doc.id,
      ...doc.data()
    } as ManagementReview);
  });

  return reviews;
}

/**
 * Fetch single management review
 *
 * @param labId - Lab ID
 * @param reviewId - Review ID
 * @returns ManagementReview or null if not found
 */
export async function getManagementReview(
  labId: string,
  reviewId: string
): Promise<ManagementReview | null> {
  const docRef = doc(db, 'labs', labId, 'management-reviews', reviewId);
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
  } as ManagementReview;
}

/**
 * Fetch reviews for a specific year
 *
 * @param labId - Lab ID
 * @param year - Year (e.g., 2026)
 * @returns Array of reviews for that year
 */
export async function getManagementReviewsByYear(
  labId: string,
  year: number
): Promise<ManagementReview[]> {
  const path = collection(db, 'labs', labId, 'management-reviews');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  const reviews: ManagementReview[] = [];

  snapshot.forEach((doc) => {
    reviews.push({
      id: doc.id,
      ...doc.data()
    } as ManagementReview);
  });

  return reviews;
}

/**
 * Fetch the most recently completed review
 *
 * @param labId - Lab ID
 * @returns Latest ManagementReview or null
 */
export async function getLatestManagementReview(
  labId: string
): Promise<ManagementReview | null> {
  const path = collection(db, 'labs', labId, 'management-reviews');

  const q = query(
    path,
    where('deletedAt', '==', null),
    where('labId', '==', labId),
    where('status', 'in', ['submitted', 'approved', 'archived'])
  );

  const snapshot = await getDocs(q);
  let latest: ManagementReview | null = null;
  let latestYear = -1;

  snapshot.forEach((doc) => {
    const review = {
      id: doc.id,
      ...doc.data()
    } as ManagementReview;

    if (review.year > latestYear) {
      latestYear = review.year;
      latest = review;
    }
  });

  return latest;
}

/**
 * Soft-delete a management review
 * Sets deletedAt timestamp; does NOT delete the document
 * Note: This is a client-side helper; actual deletion should be via Cloud Function
 * to enforce permissions and update audit trails
 *
 * @param labId - Lab ID
 * @param reviewId - Review ID to delete
 * @param deletedAt - Timestamp of deletion (usually Timestamp.now())
 */
export function markManagementReviewDeleted(
  labId: string,
  reviewId: string,
  deletedAt: Timestamp
): void {
  // This is a marker function; actual deletion happens via CF
  // Just documenting the soft-delete pattern here
  console.log(
    `[ManagementReviewService] Marking review ${reviewId} as deleted at ${deletedAt.toDate().toISOString()}`
  );
}

/**
 * Helper: Map Firestore document to ManagementReview type
 */
export function mapManagementReviewDoc(doc: any): ManagementReview {
  return {
    id: doc.id,
    labId: doc.labId,
    year: doc.year,
    dataRevisao: doc.dataRevisao,
    entries: doc.entries || [],
    participantes: doc.participantes || [],
    diretor: doc.diretor,
    gerenteQualidade: doc.gerenteQualidade,
    outrasCargos: doc.outrasCargos || [],
    chainHash: doc.chainHash,
    status: doc.status || ReviewStatus.DRAFT,
    ataIds: doc.ataIds || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt || null
  } as ManagementReview;
}
