/**
 * capaCallables.ts — Phase 8 Wave 1
 *
 * httpsCallable wrappers for CAPA Cloud Functions.
 * No logic — only typed calls to server-side functions.
 *
 * State machine: open → in-progress → evidence-submitted → auditor-reviewing → closed
 * Signature generation happens server-side via LogicalSignature pattern
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import type { CapaDocument, CapaState, LogicalSignature, Evidence, AuditorRFI } from '../types';
import type { LabId } from '../types/_shared_refs';

// ─── Functions client (regionalized) ───────────────────────────────────────

const functions = getFunctions(undefined, 'southamerica-east1');

// ─── Types for callable inputs/outputs ─────────────────────────────────────

export interface CreateCapaInput {
  ncId: string;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  dicqBlocks: string[];
  rdcArticles: string[];
  rootCause: string;
  correctiveAction: string;
  deadlineDate: number; // milliseconds
}

export interface CreateCapaOutput {
  capaId: string;
  document: CapaDocument;
}

export interface UpdateCapaStateInput {
  capaId: string;
  newState: CapaState;
  reason?: string;
}

export interface UpdateCapaStateOutput {
  capaId: string;
  document: CapaDocument;
}

export interface SubmitCapaRFIInput {
  capaId: string;
  question: string;
  dueDate: number; // milliseconds
}

export interface SubmitCapaRFIOutput {
  rfiId: string;
  document: CapaDocument;
}

export interface UploadCapaEvidenceInput {
  capaId: string;
  fileName: string;
  fileSize: number;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'text/plain';
  storagePath: string;
  hash: string; // SHA-256 hex
  description?: string;
}

export interface UploadCapaEvidenceOutput {
  evidenceId: string;
  evidence: Evidence;
  document: CapaDocument;
}

export interface SubmitAuditorSignOffInput {
  capaId: string;
  email?: string;
}

export interface SubmitAuditorSignOffOutput {
  document: CapaDocument;
  signature: LogicalSignature;
}

// ─── Callables ────────────────────────────────────────────────────────────

/**
 * Create a new CAPA in the lab.
 * Server validates: labId membership, finding uniqueness, state machine.
 * Generates LogicalSignature server-side.
 */
export async function createCapaCallable(
  labId: LabId,
  input: CreateCapaInput,
): Promise<CreateCapaOutput> {
  const fn = httpsCallable<{ labId: string; payload: CreateCapaInput }, CreateCapaOutput>(
    functions,
    'capa_createCapa',
  );
  return fn({ labId, payload: input }).then((result) => result.data);
}

/**
 * Update CAPA state (open → in-progress → evidence-submitted → auditor-reviewing → closed).
 * Server validates state machine transitions.
 */
export async function updateCapaStateCallable(
  labId: LabId,
  capaId: string,
  newState: CapaState,
  reason?: string,
): Promise<UpdateCapaStateOutput> {
  const fn = httpsCallable<
    { labId: string; capaId: string; newState: CapaState; reason?: string },
    UpdateCapaStateOutput
  >(functions, 'capa_updateCapaState');
  return fn({ labId, capaId, newState, reason }).then((result) => result.data);
}

/**
 * Submit an RFI (Request For Information) to the auditor.
 */
export async function submitCapaRFICallable(
  labId: LabId,
  capaId: string,
  question: string,
  dueDate: number,
): Promise<SubmitCapaRFIOutput> {
  const fn = httpsCallable<
    { labId: string; capaId: string; question: string; dueDate: number },
    SubmitCapaRFIOutput
  >(functions, 'capa_submitCapaRFI');
  return fn({ labId, capaId, question, dueDate }).then((result) => result.data);
}

/**
 * Upload evidence file for CAPA (file metadata + hash).
 * Server validates file hash matches payload.
 */
export async function uploadCapaEvidenceCallable(
  labId: LabId,
  payload: UploadCapaEvidenceInput,
): Promise<UploadCapaEvidenceOutput> {
  const fn = httpsCallable<
    { labId: string; payload: UploadCapaEvidenceInput },
    UploadCapaEvidenceOutput
  >(functions, 'capa_uploadCapaEvidence');
  return fn({ labId, payload }).then((result) => result.data);
}

/**
 * Submit auditor sign-off on CAPA closure.
 * Server generates LogicalSignature with operatorId = current user.
 */
export async function submitAuditorSignOffCallable(
  labId: LabId,
  payload: SubmitAuditorSignOffInput,
): Promise<SubmitAuditorSignOffOutput> {
  const fn = httpsCallable<
    { labId: string; payload: SubmitAuditorSignOffInput },
    SubmitAuditorSignOffOutput
  >(functions, 'capa_submitAuditorSignOff');
  return fn({ labId, payload }).then((result) => result.data);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const capaCallables = {
  createCapaCallable,
  updateCapaStateCallable,
  submitCapaRFICallable,
  uploadCapaEvidenceCallable,
  submitAuditorSignOffCallable,
};
