/**
 * calibracaoService.ts — Phase 8 Wave 1
 *
 * Equipment calibration CRUD and audit reporting.
 * Reads: subscribeToCalibracoes, getCalibracaoById, getCalibracaoAuditReport
 * Writes: via callable wrappers (Cloud Function server-side only)
 *
 * Multi-tenant: `/labs/{labId}/calibracao/{recordId}`
 * DICQ 5.3.1.4 — equipment calibration tracking with due-date alerts
 */

import {
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CalibracaoRecord,
  CalibracaoStatus,
} from '../types';
import type { LabId } from '../types/_shared_refs';

// ─── Paths ────────────────────────────────────────────────────────────────

const calibracaoCol = (labId: LabId): CollectionReference =>
  collection(db, 'labs', labId, 'calibracao');

const calibracaoDoc = (labId: LabId, id: string): DocumentReference =>
  doc(calibracaoCol(labId), id);

// ─── Mapping snapshot → entity ─────────────────────────────────────────────

function mapCalibracaoRecord(snap: QueryDocumentSnapshot): CalibracaoRecord {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    equipamentoId: d.equipamentoId as string,
    calibrationMethod: d.calibrationMethod as string,
    nextDueDate: d.nextDueDate.toMillis?.() ?? d.nextDueDate,
    status: d.status as CalibracaoStatus,
    certificates: d.certificates ?? [],
    lastCalibrationDate: d.lastCalibrationDate?.toMillis?.() ?? d.lastCalibrationDate,
    uploadedBy: d.uploadedBy as string,
    uploadedAt: d.uploadedAt?.toMillis?.() ?? d.uploadedAt,
    notes: d.notes,
    deletedAt: d.deletedAt,
  } as CalibracaoRecord;
}

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Get a single calibration record by ID.
 */
export async function getCalibracaoById(labId: LabId, id: string): Promise<CalibracaoRecord | null> {
  const snap = await getDoc(calibracaoDoc(labId, id));
  if (!snap.exists()) return null;
  return mapCalibracaoRecord(snap);
}

/**
 * Subscribe to all calibration records in the lab.
 * Filters out soft-deleted records client-side.
 */
export function subscribeToCalibracoes(
  labId: LabId,
  onUpdate: (records: CalibracaoRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(calibracaoCol(labId), orderBy('nextDueDate', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs
        .map(mapCalibracaoRecord)
        .filter((rec) => !rec.deletedAt);
      onUpdate(records);
    },
    (err) => {
      if (onError) onError(new Error(`Subscribe error: ${err.message}`));
    },
  );
}

/**
 * Get audit report for a specific equipment's calibration history.
 */
export async function getCalibracaoAuditReport(labId: LabId, equipamentoId: string): Promise<CalibracaoRecord[]> {
  const q = query(
    calibracaoCol(labId),
    where('equipamentoId', '==', equipamentoId),
    orderBy('lastCalibrationDate', 'desc'),
  );

  const snapshot = await db.collection('labs').doc(labId).collection('calibracao').get();
  return snapshot.docs
    .map(mapCalibracaoRecord)
    .filter((rec) => rec.equipamentoId === equipamentoId)
    .sort((a, b) => {
      const aDate = a.lastCalibrationDate ?? 0;
      const bDate = b.lastCalibrationDate ?? 0;
      return bDate - aDate;
    });
}

// ─── Callables (server-side writes) ────────────────────────────────────────

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'southamerica-east1');

export interface UploadCalibracaoCertificateInput {
  equipmentoId: string;
  certificateUrl: string;
  validUntil: number; // milliseconds
  methodology: string;
}

export interface FlagEquipamentoOutOfServiceInput {
  equipamentoId: string;
  reason: string;
}

/**
 * Upload calibration certificate via Cloud Function.
 * Server validates equipment exists and updates nextDueDate.
 */
export async function uploadCalibracaoCertificateCallable(
  labId: LabId,
  equipmentoId: string,
  payload: UploadCalibracaoCertificateInput,
): Promise<{ recordId: string; record: CalibracaoRecord }> {
  const fn = httpsCallable<
    { labId: string; equipmentoId: string; payload: UploadCalibracaoCertificateInput },
    { recordId: string; record: CalibracaoRecord }
  >(functions, 'calibracao_uploadCertificate');
  return fn({ labId, equipmentoId, payload }).then((result) => result.data);
}

/**
 * Flag equipment as out-of-service via Cloud Function.
 */
export async function flagEquipamentoOutOfServiceCallable(
  labId: LabId,
  equipmentoId: string,
  payload: FlagEquipamentoOutOfServiceInput,
): Promise<{ recordId: string; record: CalibracaoRecord }> {
  const fn = httpsCallable<
    { labId: string; equipmentoId: string; payload: FlagEquipamentoOutOfServiceInput },
    { recordId: string; record: CalibracaoRecord }
  >(functions, 'calibracao_flagOutOfService');
  return fn({ labId, equipmentoId, payload }).then((result) => result.data);
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const calibracaoService = {
  getCalibracaoById,
  subscribeToCalibracoes,
  getCalibracaoAuditReport,
  uploadCalibracaoCertificateCallable,
  flagEquipamentoOutOfServiceCallable,
};
