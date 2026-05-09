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
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from '../../../shared/services/firebase';
import type {
  ManagementReviewMeeting,
} from '../types';
import type { LabId } from '../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const managementReviewCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'management-review');

const managementReviewDoc = (labId: LabId, id: string): DocumentReference =>
  doc(managementReviewCol(labId), id);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapManagementReviewMeeting(snap: QueryDocumentSnapshot): ManagementReviewMeeting {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    dataReuniao: d.dataReuniao?.toMillis?.() ?? d.dataReuniao,
    ano: d.ano as number,
    entries: d.entries ?? [],
    attendees: d.attendees ?? [],
    decisions: d.decisions ?? [],
    signatures: d.signatures ?? [],
    criadoEm: d.criadoEm?.toMillis?.() ?? d.criadoEm,
    deletedAt: d.deletedAt,
  } as ManagementReviewMeeting;
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get all management review meetings for the lab (ordered by date DESC).
 */
export async function getMeetings(labId: LabId, limit?: number): Promise<ManagementReviewMeeting[]> {
  const q = query(managementReviewCol(labId), orderBy('dataReuniao', 'desc'));
  const snapshot = await getDocs(q);
  const meetings = snapshot.docs
    .map(mapManagementReviewMeeting)
    .filter((m) => !m.deletedAt);

  return limit ? meetings.slice(0, limit) : meetings;
}

/**
 * Get a single management review meeting by ID.
 */
export async function getMeetingById(labId: LabId, id: string): Promise<ManagementReviewMeeting | null> {
  const snap = await getDoc(managementReviewDoc(labId, id));
  if (!snap.exists()) return null;
  return mapManagementReviewMeeting(snap);
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
  meeting: ManagementReviewMeeting;
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
