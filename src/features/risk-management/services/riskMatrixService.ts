/**
 * riskMatrixService.ts — Phase 8 Wave 1
 *
 * Risk management extending existing risks module.
 * Adds heatmap view + PDF export via callable.
 * Reads: subscribeToRisks, getRisks
 * Writes: via callable (Cloud Function server-side only)
 *
 * Multi-tenant: `/labs/{labId}/risks/{riskId}` (existing path)
 * FMEA-Lite: NPR = P × S × D (calculated client-side at render, not persisted)
 * RDC 978 Art. 86 + DICQ 4.14.6 — risk register management
 */

import {
  collection,
  db,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { LabId } from '../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const risksCol = (labId: LabId): CollectionReference => collection(db, 'labs', labId, 'risks');

const riskDoc = (labId: LabId, riskId: string): DocumentReference => doc(risksCol(labId), riskId);

// ─── Risk types (minimal — extend as needed) ──────────────────────────────

export interface RiskRecord {
  id: string;
  labId: LabId;
  title: string;
  description: string;
  probability: number; // 1–5
  severity: number; // 1–5
  detectability: number; // 1–5
  mitigation?: string;
  owner?: string;
  reviewDate?: number; // milliseconds
  criadoEm: number | { toMillis(): number };
  deletedAt?: number;
}

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapRiskRecord(snap: QueryDocumentSnapshot): RiskRecord {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    title: d.title as string,
    description: d.description as string,
    probability: d.probability as number,
    severity: d.severity as number,
    detectability: d.detectability as number,
    mitigation: d.mitigation,
    owner: d.owner,
    reviewDate: d.reviewDate?.toMillis?.() ?? d.reviewDate,
    criadoEm: d.criadoEm?.toMillis?.() ?? d.criadoEm,
    deletedAt: d.deletedAt,
  } as RiskRecord;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function calculateNPR(probability: number, severity: number, detectability: number): number {
  return probability * severity * detectability;
}

export function getRiskLevel(npr: number): 'low' | 'medium' | 'high' | 'critical' {
  if (npr <= 24) return 'low';
  if (npr <= 74) return 'medium';
  if (npr <= 124) return 'high';
  return 'critical';
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get all risks for the lab.
 */
export async function getRisks(labId: LabId): Promise<RiskRecord[]> {
  const q = query(risksCol(labId), orderBy('criadoEm', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapRiskRecord).filter((risk) => !risk.deletedAt);
}

/**
 * Subscribe to all risks in the lab (real-time updates).
 */
export function subscribeToRisks(
  labId: LabId,
  onUpdate: (risks: RiskRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(risksCol(labId), orderBy('criadoEm', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const risks = snapshot.docs.map(mapRiskRecord).filter((risk) => !risk.deletedAt);
      onUpdate(risks);
    },
    (err) => {
      if (onError) onError(new Error(`Subscribe error: ${err.message}`));
    },
  );
}

// ─── Callables (server-side writes) ────────────────────────────────────────

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'southamerica-east1');

export interface CreateRiskInput {
  title: string;
  description: string;
  probability: number;
  severity: number;
  detectability: number;
  mitigation?: string;
  owner?: string;
}

export interface CreateRiskOutput {
  riskId: string;
  risk: RiskRecord;
}

export interface UpdateRiskInput {
  title?: string;
  description?: string;
  probability?: number;
  severity?: number;
  detectability?: number;
  mitigation?: string;
  owner?: string;
  reviewDate?: number;
}

export interface UpdateRiskOutput {
  riskId: string;
  risk: RiskRecord;
}

export interface GenerateRiskMatrixPDFOutput {
  pdfUrl: string;
  fileName: string;
}

/**
 * Create a new risk via Cloud Function.
 */
export async function createRiskCallable(
  labId: LabId,
  input: CreateRiskInput,
): Promise<CreateRiskOutput> {
  const fn = httpsCallable<{ labId: string; payload: CreateRiskInput }, CreateRiskOutput>(
    functions,
    'risks_createRisk',
  );
  return fn({ labId, payload: input }).then((result) => result.data);
}

/**
 * Update a risk via Cloud Function.
 */
export async function updateRiskCallable(
  labId: LabId,
  riskId: string,
  updates: UpdateRiskInput,
): Promise<UpdateRiskOutput> {
  const fn = httpsCallable<
    { labId: string; riskId: string; updates: UpdateRiskInput },
    UpdateRiskOutput
  >(functions, 'risks_updateRisk');
  return fn({ labId, riskId, updates }).then((result) => result.data);
}

/**
 * Generate risk matrix heatmap as PDF via Cloud Function.
 * Returns a download URL for the generated PDF.
 */
export async function generateRiskMatrixPDFCallable(
  labId: LabId,
): Promise<GenerateRiskMatrixPDFOutput> {
  const fn = httpsCallable<{ labId: string }, GenerateRiskMatrixPDFOutput>(
    functions,
    'risks_generateMatrixPDF',
  );
  return fn({ labId }).then((result) => result.data);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const riskMatrixService = {
  getRisks,
  subscribeToRisks,
  createRiskCallable,
  updateRiskCallable,
  generateRiskMatrixPDFCallable,
};
