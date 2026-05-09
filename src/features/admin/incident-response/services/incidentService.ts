/**
 * Incident Response Service
 *
 * Service layer for incident CRUD operations.
 * All writes are Cloud Function callables (server-sealed).
 * Reads use Firestore snapshots (real-time listeners).
 *
 * Per project convention (thin service, fat hooks):
 * - Service: CRUD + mapping Firestore snapshot → entity
 * - Hooks: validation, audit integration, error handling
 */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Query,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { db, functions } from '@/shared/services/firebase';

import type {
  Incident,
  IncidentAction,
  PostMortemAction,
  IncidentStatus,
  SeverityLevel,
  CreateIncidentInput,
  EscalateIncidentInput,
  RecordPostMortemInput,
  CreateIncidentResponse,
} from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

const INCIDENTS_COLLECTION = (labId: string) => `labs/${labId}/incidents`;
const INCIDENT_DOC = (labId: string, incidentId: string) => `${INCIDENTS_COLLECTION(labId)}/${incidentId}`;
const INCIDENT_ACTIONS_COLLECTION = (labId: string, incidentId: string) =>
  `${INCIDENT_DOC(labId, incidentId)}/actions`;
const INCIDENT_POST_MORTEM_COLLECTION = (labId: string, incidentId: string) =>
  `${INCIDENT_DOC(labId, incidentId)}/post-mortem-actions`;

// ─── Cloud Function Callables ──────────────────────────────────────────────

interface CreateIncidentPayload extends CreateIncidentInput {
  labId: string;
}

interface EscalateIncidentPayload extends EscalateIncidentInput {
  labId: string;
  incidentId: string;
}

interface CloseIncidentPayload {
  labId: string;
  incidentId: string;
  notes?: string;
}

interface RecordPostMortemPayload extends RecordPostMortemInput {
  labId: string;
  incidentId: string;
}

// ─── Create Incident ───────────────────────────────────────────────────────

/**
 * Creates a new incident and returns the incident ID.
 * Writes are server-sealed (Cloud Function callable).
 *
 * @param labId Multi-tenant lab identifier
 * @param input Validated incident creation payload
 * @returns Incident ID and audit entry ID
 * @throws Error if creation fails (invalid input, auth error, etc.)
 */
export async function createIncident(
  labId: string,
  input: CreateIncidentInput
): Promise<CreateIncidentResponse> {
  const createIncidentCallable = httpsCallable<CreateIncidentPayload, CreateIncidentResponse>(
    functions,
    'createIncident'
  );

  try {
    const result = await createIncidentCallable({
      labId,
      ...input,
    });
    return result.data;
  } catch (error) {
    console.error('[incidentService] createIncident error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to create incident'
    );
  }
}

// ─── Escalate Incident ─────────────────────────────────────────────────────

/**
 * Escalates an incident to higher severity level.
 * Triggered when Yellow → Red or Red → Black conditions met.
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to escalate
 * @param input Escalation details (new severity, reason)
 * @throws Error if escalation fails or severity downgrade attempted
 */
export async function escalateIncident(
  labId: string,
  incidentId: string,
  input: EscalateIncidentInput
): Promise<void> {
  const escalateIncidentCallable = httpsCallable<EscalateIncidentPayload, { escalated: boolean }>(
    functions,
    'escalateIncident'
  );

  try {
    await escalateIncidentCallable({
      labId,
      incidentId,
      ...input,
    });
  } catch (error) {
    console.error('[incidentService] escalateIncident error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to escalate incident'
    );
  }
}

// ─── Close Incident ───────────────────────────────────────────────────────

/**
 * Closes an incident (marks as resolved, calculates MTTR).
 * Incident Commander calls this when mitigation complete.
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to close
 * @param notes Optional closure notes
 * @throws Error if incident not found or invalid state
 */
export async function closeIncident(
  labId: string,
  incidentId: string,
  notes?: string
): Promise<void> {
  const closeIncidentCallable = httpsCallable<CloseIncidentPayload, { closed: boolean; mttr: number }>(
    functions,
    'closeIncident'
  );

  try {
    await closeIncidentCallable({
      labId,
      incidentId,
      notes,
    });
  } catch (error) {
    console.error('[incidentService] closeIncident error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to close incident'
    );
  }
}

// ─── Record Post-Mortem ────────────────────────────────────────────────────

/**
 * Records post-mortem findings after incident resolution.
 * Stores document link and action items for follow-up tracking.
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to attach post-mortem to
 * @param input Post-mortem document link and action items
 * @throws Error if incident not found or already has post-mortem
 */
export async function recordPostMortem(
  labId: string,
  incidentId: string,
  input: RecordPostMortemInput
): Promise<void> {
  const recordPostMortemCallable = httpsCallable<RecordPostMortemPayload, { recorded: boolean }>(
    functions,
    'recordPostMortem'
  );

  try {
    await recordPostMortemCallable({
      labId,
      incidentId,
      ...input,
    });
  } catch (error) {
    console.error('[incidentService] recordPostMortem error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to record post-mortem'
    );
  }
}

// ─── Fetch Single Incident ─────────────────────────────────────────────────

/**
 * Fetches a single incident by ID with all related data.
 * One-time fetch (not real-time).
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to fetch
 * @returns Incident document with populated data
 * @throws Error if incident not found
 */
export async function getIncident(labId: string, incidentId: string): Promise<Incident> {
  const docRef = doc(db, INCIDENT_DOC(labId, incidentId));

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Incident ${incidentId} not found`);
    }
    return snap.data() as Incident;
  } catch (error) {
    console.error('[incidentService] getIncident error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to fetch incident'
    );
  }
}

// ─── Fetch Incident Actions ────────────────────────────────────────────────

/**
 * Fetches all actions taken on an incident.
 * One-time fetch (not real-time).
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to fetch actions for
 * @returns Array of actions, ordered by time
 */
export async function getIncidentActions(
  labId: string,
  incidentId: string
): Promise<IncidentAction[]> {
  const actionsRef = collection(db, INCIDENT_ACTIONS_COLLECTION(labId, incidentId));
  const q = query(actionsRef, orderBy('takenAt', 'asc'));

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as IncidentAction);
  } catch (error) {
    console.error('[incidentService] getIncidentActions error:', error);
    return [];
  }
}

// ─── Subscribe to Incidents (Real-time) ────────────────────────────────────

interface SubscribeIncidentsOptions {
  status?: IncidentStatus;
  severity?: SeverityLevel;
  limit?: number;
}

/**
 * Real-time listener for incidents with optional filtering.
 * Used for incident dashboard, on-call IC tracking, etc.
 *
 * IMPORTANT: Caller MUST unsubscribe in useEffect cleanup to avoid memory leaks.
 *
 * @param labId Multi-tenant lab identifier
 * @param options Filters (status, severity, limit)
 * @param callback Invoked with incident list on change
 * @returns Unsubscribe function (call in useEffect cleanup)
 *
 * @example
 * useEffect(() => {
 *   const unsubscribe = subscribeIncidents(
 *     labId,
 *     { status: 'open' },
 *     (incidents) => setIncidents(incidents)
 *   );
 *   return unsubscribe; // Cleanup
 * }, [labId]);
 */
export function subscribeIncidents(
  labId: string,
  options: SubscribeIncidentsOptions,
  callback: (incidents: Incident[]) => void
): Unsubscribe {
  const incidentsRef = collection(db, INCIDENTS_COLLECTION(labId));

  // Build query constraints
  const constraints: QueryConstraint[] = [orderBy('declaredAt', 'desc')];

  if (options.status) {
    constraints.push(where('status', '==', options.status));
  }

  if (options.severity) {
    constraints.push(where('severity', '==', options.severity));
  }

  if (options.limit) {
    constraints.push(limit(options.limit));
  }

  const q = query(incidentsRef, ...constraints);

  // Set up real-time listener
  const unsubscribe = onSnapshot(q, (snap) => {
    const incidents = snap.docs.map((d) => d.data() as Incident);
    callback(incidents);
  });

  return unsubscribe;
}

// ─── List All Incidents (Paginated) ────────────────────────────────────────

/**
 * Fetches all incidents for a lab (one-time, paginated).
 * Use when you don't need real-time updates.
 *
 * @param labId Multi-tenant lab identifier
 * @param maxResults Maximum number of incidents to return
 * @returns Array of incidents, ordered newest first
 */
export async function listIncidents(
  labId: string,
  maxResults: number = 50
): Promise<Incident[]> {
  const incidentsRef = collection(db, INCIDENTS_COLLECTION(labId));
  const q = query(
    incidentsRef,
    orderBy('declaredAt', 'desc'),
    limit(maxResults)
  );

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Incident);
  } catch (error) {
    console.error('[incidentService] listIncidents error:', error);
    return [];
  }
}

// ─── Soft Delete Incident ──────────────────────────────────────────────────

/**
 * Soft-deletes an incident (marks as deleted, preserves audit trail).
 * Per RDC-06 convention, never hard delete.
 *
 * @param labId Multi-tenant lab identifier
 * @param incidentId Incident to soft-delete
 * @throws Error if deletion fails
 */
export async function softDeleteIncident(labId: string, incidentId: string): Promise<void> {
  const softDeleteCallable = httpsCallable<
    { labId: string; incidentId: string },
    { deleted: boolean }
  >(functions, 'softDeleteIncident');

  try {
    await softDeleteCallable({ labId, incidentId });
  } catch (error) {
    console.error('[incidentService] softDeleteIncident error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to soft-delete incident'
    );
  }
}

// ─── Export helpers for hooks ──────────────────────────────────────────────

/**
 * Maps Firestore Incident → displayable incident with formatted dates
 * (helper for view layer, not required by convention but useful)
 */
export function formatIncidentForDisplay(incident: Incident) {
  return {
    ...incident,
    declaredAtStr: incident.declaredAt.toDate().toLocaleString('pt-BR'),
    resolvedAtStr: incident.resolvedAt?.toDate().toLocaleString('pt-BR') ?? '—',
    mttrStr: incident.actualMTTR ? `${incident.actualMTTR}m` : '—',
  };
}
