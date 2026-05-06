/**
 * calibracaoService.ts
 *
 * Multi-tenant Firestore service for equipment calibration tracking.
 * Collection: `/labs/{labId}/calibracao/{equipId}`
 *
 * Padrão: Thin service (CRUD + mapping only, zero business logic).
 * Soft-delete only (RN-06) — never deleteDoc.
 * Multi-tenant: labId on every path + redundant in payload (defense-in-depth).
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type {
  CalibracaoInput,
  CalibracaoRecord,
  DueDateInfo,
  CalibracaoStatus,
} from '../types/index';

// ─── Paths ───────────────────────────────────────────────────────────────────

const CALIBRACAO_ROOT = 'calibracao';

/**
 * Root document for tenant (acts as collection anchor).
 * Rules prevent read/write outside own labId.
 */
const labRootDoc = (labId: string): DocumentReference =>
  doc(db, CALIBRACAO_ROOT, labId);

export const calibracaoCol = (labId: string): CollectionReference =>
  collection(labRootDoc(labId), 'equipamentos');

const calibracaoDoc = (labId: string, equipId: string): DocumentReference =>
  doc(calibracaoCol(labId), equipId);

/**
 * Ensures lab root document exists before writing to subcollections.
 * Uses setDoc with merge:true for idempotency.
 */
async function ensureLabRoot(labId: string): Promise<void> {
  await setDoc(labRootDoc(labId), { labId }, { merge: true });
}

// ─── Derived computations ─────────────────────────────────────────────────────

/**
 * Compute due date status from nextDueDate.
 * Status thresholds:
 * - >30 days: "no-prazo" (on-track)
 * - 7-30 days: "em-risco" (at-risk)
 * - <7 days: "vencido" (overdue, includes negative)
 */
function computeDueDateStatus(
  nextDueDate: Timestamp,
  now: Date = new Date(),
): CalibracaoStatus {
  const daysUntil = Math.floor(
    (nextDueDate.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysUntil > 30) return 'no-prazo';
  if (daysUntil > 7) return 'em-risco';
  return 'vencido';
}

/**
 * Compute DueDateInfo from nextDueDate.
 */
function computeDueDateInfo(nextDueDate: Timestamp): DueDateInfo {
  const now = new Date();
  const daysUntilDue = Math.floor(
    (nextDueDate.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const status = computeDueDateStatus(nextDueDate, now);

  return {
    nextDueDate,
    daysUntilDue,
    status,
    alertsSent: {
      dias30: daysUntilDue <= 30,
      dias15: daysUntilDue <= 15,
      dias7: daysUntilDue <= 7,
    },
  };
}

/**
 * Map Firestore snapshot to CalibracaoRecord entity.
 * Adds computed fields (dueDateInfo).
 */
function mapCalibracaoSnapshot(
  snapshot: QueryDocumentSnapshot | any,
): CalibracaoRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    labId: data.labId,
    equipId: data.equipId,
    equipName: data.equipName,
    equipSerial: data.equipSerial,
    lastCalibrationDate: data.lastCalibrationDate,
    nextDueDate: data.nextDueDate,
    vendor: data.vendor,
    vendorRef: data.vendorRef,
    certificates: data.certificates || [],
    dueDateInfo: computeDueDateInfo(data.nextDueDate),
    notes: data.notes,
    criadoEm: data.criadoEm,
    atualizadoEm: data.atualizadoEm,
    deletadoEm: data.deletadoEm,
  };
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

/**
 * Get single calibration record for equipment.
 * Returns null if not found or soft-deleted.
 */
export async function getCalibracao(
  labId: string,
  equipId: string,
): Promise<CalibracaoRecord | null> {
  const ref = calibracaoDoc(labId, equipId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.deletadoEm !== null && data.deletadoEm !== undefined) return null;

  return mapCalibracaoSnapshot(snap);
}

/**
 * Subscribe to single calibration record (real-time).
 * Filters out soft-deleted records client-side.
 */
export function watchCalibracao(
  labId: string,
  equipId: string,
  callback: (record: CalibracaoRecord | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = calibracaoDoc(labId, equipId);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }

      const data = snap.data();
      if (data.deletadoEm !== null && data.deletadoEm !== undefined) {
        callback(null);
        return;
      }

      callback(mapCalibracaoSnapshot(snap));
    },
    (err) => {
      if (onError) onError(err as Error);
    },
  );
}

/**
 * Subscribe to all calibration records for lab.
 * Filters out soft-deleted records.
 * Sorted by nextDueDate ascending (soonest due first).
 */
export function watchCalibraces(
  labId: string,
  callback: (records: CalibracaoRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const col = calibracaoCol(labId);
  const q = query(
    col,
    where('deletadoEm', '==', null),
    orderBy('nextDueDate', 'asc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs
        .map(mapCalibracaoSnapshot)
        .filter((r) => r.deletadoEm === null);
      callback(records);
    },
    (err) => {
      if (onError) onError(err as Error);
    },
  );
}

/**
 * Create new calibration record for equipment.
 * Generates audit fields (criadoEm, atualizadoEm, deletadoEm).
 */
export async function createCalibracao(
  labId: string,
  input: CalibracaoInput,
): Promise<string> {
  await ensureLabRoot(labId);

  const ref = calibracaoDoc(labId, input.equipId);
  const now = serverTimestamp();

  await setDoc(ref, {
    labId,
    ...input,
    criadoEm: now,
    atualizadoEm: now,
    deletadoEm: null,
  });

  return ref.id;
}

/**
 * Update calibration record (partial update).
 * Preserves criadoEm, updates atualizadoEm.
 * Never mutates labId or deletadoEm via this path.
 */
export async function updateCalibracao(
  labId: string,
  equipId: string,
  updates: Partial<Omit<CalibracaoRecord, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>>,
): Promise<void> {
  const ref = calibracaoDoc(labId, equipId);

  await updateDoc(ref, {
    ...updates,
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * Soft-delete calibration record (RN-06).
 * Sets deletadoEm to current timestamp.
 */
export async function softDeleteCalibracao(
  labId: string,
  equipId: string,
  operatorId: string,
): Promise<void> {
  const ref = calibracaoDoc(labId, equipId);

  await updateDoc(ref, {
    deletadoEm: serverTimestamp(),
    // Optional: add audit field to track who deleted it
    deletadoPor: operatorId,
  });
}

/**
 * Restore (undo soft-delete) calibration record.
 */
export async function restoreCalibracao(
  labId: string,
  equipId: string,
): Promise<void> {
  const ref = calibracaoDoc(labId, equipId);

  await updateDoc(ref, {
    deletadoEm: null,
  });
}

/**
 * Add certificate to calibration record's certificates array.
 * (In practice, this may be called by Cloud Function after validation)
 */
export async function addCertificateToCalibracao(
  labId: string,
  equipId: string,
  certificate: any, // CertificateUpload shape
): Promise<void> {
  const ref = calibracaoDoc(labId, equipId);
  const record = await getCalibracao(labId, equipId);

  if (!record) {
    throw new Error(`Calibration record not found for ${equipId}`);
  }

  const updatedCerts = [...(record.certificates || []), certificate];

  await updateDoc(ref, {
    certificates: updatedCerts,
    atualizadoEm: serverTimestamp(),
  });
}
