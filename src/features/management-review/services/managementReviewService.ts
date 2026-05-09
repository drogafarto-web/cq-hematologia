/**
 * managementReviewService.ts — Phase 8 Wave 1
 *
 * Annual direction critical analysis meetings (reuniões de revisão gerencial).
 * Reads: getMeetings, getMeetingById
 * Writes: via callable (Cloud Function server-side only)
 *
 * Multi-tenant: `/labs/{labId}/management-review/{meetingId}`
 * DICQ 4.15 — 15 mandatory review entries with signatures
 */

import {
  collection,
  db,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from '../../../shared/services/firebase';
import type {
  ManagementReview,
} from '../types';
import type { LabId } from '../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const managementReviewCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'management-reviews');

const managementReviewDoc = (labId: LabId, id: string): DocumentReference =>
  doc(managementReviewCol(labId), id);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function asTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }
  return Timestamp.now();
}

function mapManagementReview(snap: QueryDocumentSnapshot): ManagementReview {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    year: d.year as number,
    dataRevisao: asTimestamp(d.dataRevisao),
    entries: d.entries ?? [],
    participantes: d.participantes ?? [],
    diretor: (d.diretor ?? '') as string,
    gerenteQualidade: (d.gerenteQualidade ?? '') as string,
    outrasCargos: d.outrasCargos,
    chainHash: d.chainHash,
    status: (d.status ?? 'draft') as ManagementReview['status'],
    ataIds: d.ataIds ?? [],
    createdAt: asTimestamp(d.createdAt),
    updatedAt: asTimestamp(d.updatedAt),
    deletedAt: d.deletedAt ?? null,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get all management reviews for the lab (ordered by date DESC).
 */
export async function getMeetings(labId: LabId, limit?: number): Promise<ManagementReview[]> {
  const q = query(managementReviewCol(labId), orderBy('dataRevisao', 'desc'));
  const snapshot = await getDocs(q);
  const reviews = snapshot.docs
    .map(mapManagementReview)
    .filter((r) => !r.deletedAt);

  return limit ? reviews.slice(0, limit) : reviews;
}

/**
 * Get a single management review by ID.
 */
export async function getMeetingById(labId: LabId, id: string): Promise<ManagementReview | null> {
  const snap = await getDoc(managementReviewDoc(labId, id));
  if (!snap.exists()) return null;
  return mapManagementReview(snap as QueryDocumentSnapshot);
}

// ─── Callables (server-side writes) ────────────────────────────────────────

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'southamerica-east1');

export interface AggregateManagementReviewDataInput {
  dateRange: {
    from: number; // milliseconds
    to: number; // milliseconds
  };
}

export interface AggregateManagementReviewDataOutput {
  entries: Array<{
    entryNumber: number;
    title: string;
    data: unknown;
    source: string;
    lastUpdated: number;
  }>;
}

export interface CreateMeetingInput {
  ano: number;
  dataReuniao: number; // milliseconds
  attendees: string[];
  decisions: string[];
}

export interface CreateMeetingOutput {
  meetingId: string;
  meeting: ManagementReview;
}

/**
 * Aggregate data for the 15 mandatory management review entries.
 * Queries across modules (CAPA, calibração, treinamentos, etc).
 */
export async function aggregateManagementReviewDataCallable(
  labId: LabId,
  dateRange: { from: number; to: number },
): Promise<AggregateManagementReviewDataOutput> {
  const fn = httpsCallable<
    { labId: string; dateRange: { from: number; to: number } },
    AggregateManagementReviewDataOutput
  >(functions, 'managementReview_aggregateData');
  return fn({ labId, dateRange }).then((result) => result.data);
}

/**
 * Create a new management review meeting via Cloud Function.
 * Server populates the 15 entries with aggregated data.
 */
export async function createMeetingCallable(
  labId: LabId,
  input: CreateMeetingInput,
): Promise<CreateMeetingOutput> {
  const fn = httpsCallable<
    { labId: string; payload: CreateMeetingInput },
    CreateMeetingOutput
  >(functions, 'managementReview_createMeeting');
  return fn({ labId, payload: input }).then((result) => result.data);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const managementReviewService = {
  getMeetings,
  getMeetingById,
  aggregateManagementReviewDataCallable,
  createMeetingCallable,
};
