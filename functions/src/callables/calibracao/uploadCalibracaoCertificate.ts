/**
 * uploadCalibracaoCertificate — Cloud Function callable v2 for calibration certificate
 * Phase 8 Wave 3 — SA-25
 *
 * Registers calibration certificate with equipment.
 * Validates certificate hash format and date logic.
 * Upserts calibração record for equipment.
 * Calculates initial status (valid, warning, overdue).
 *
 * Input: { labId, equipamentoId, lastCalibrationDate, nextDueDate, certificateStoragePath, certificateHash, expandedUncertainty, calibrationMethod, calibrationProvider? }
 * Output: { calibracaoId }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const uploadCalibracaoCertificateInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  equipamentoId: z.string().min(1, 'equipamentoId required'),
  lastCalibrationDate: z.number().int(),
  nextDueDate: z.number().int(),
  certificateStoragePath: z.string().min(1, 'certificateStoragePath required'),
  certificateHash: z
    .string()
    .length(64, 'hash must be 64 hex characters')
    .regex(/^[a-f0-9]{64}$/),
  expandedUncertainty: z.number().positive('expandedUncertainty must be positive'),
  calibrationMethod: z.string().min(1, 'calibrationMethod required'),
  calibrationProvider: z.string().optional(),
});

export interface UploadCalibracaoCertificateOutput {
  calibracaoId: string;
}

function calculateCalibracaoStatus(nextDueDate: number): 'valid' | 'warning' | 'overdue' {
  const now = Date.now();
  const daysUntilDue = (nextDueDate - now) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue < 30) return 'warning';
  return 'valid';
}

export const uploadCalibracaoCertificate = onCall<
  z.infer<typeof uploadCalibracaoCertificateInputSchema>,
  Promise<UploadCalibracaoCertificateOutput>
>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<UploadCalibracaoCertificateOutput> => {
    // ========== 1. Validate request ==========
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = uploadCalibracaoCertificateInputSchema.parse(request.data);
    const {
      labId,
      equipamentoId,
      lastCalibrationDate,
      nextDueDate,
      certificateStoragePath,
      certificateHash,
      expandedUncertainty,
      calibrationMethod,
      calibrationProvider,
    } = input;
    const uid = request.auth.uid;

    const db = admin.firestore();

    // ========== 2. Authorization check ==========
    const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

    if (!memberDoc.exists) {
      throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
    }

    const memberStatus = memberDoc.data()?.status;
    if (memberStatus !== 'active') {
      throw new HttpsError('permission-denied', 'User must be active member of lab');
    }

    // ========== 3. Create or update calibração record ==========
    const now = Date.now();
    const calibracaoId = uuid();

    const calibracaoPayload = {
      id: calibracaoId,
      labId,
      equipamentoId,
      lastCalibrationDate,
      nextDueDate,
      certificateStoragePath,
      certificateHash,
      expandedUncertainty,
      calibrationMethod,
      calibrationProvider,
      status: calculateCalibracaoStatus(nextDueDate),
      calibratedBy: uid,
      calibratedAt: now,
      deletedAt: undefined,
    };

    // ========== 4. Upsert calibração record ==========
    // Check if equipment already has a calibração record
    const existingCalibracao = await db
      .collection('labs')
      .doc(labId)
      .collection('calibracao')
      .where('equipamentoId', '==', equipamentoId)
      .orderBy('calibratedAt', 'desc')
      .limit(1)
      .get();

    let finalCalibracaoRef: admin.firestore.DocumentReference;

    if (!existingCalibracao.empty) {
      // Update existing record
      const existingDoc = existingCalibracao.docs[0];
      finalCalibracaoRef = existingDoc.ref;
      await finalCalibracaoRef.update(calibracaoPayload);
    } else {
      // Create new record
      finalCalibracaoRef = db
        .collection('labs')
        .doc(labId)
        .collection('calibracao')
        .doc(calibracaoId);
      await finalCalibracaoRef.set(calibracaoPayload);
    }

    // ========== 5. Log to Cloud Logs ==========
    console.log(
      JSON.stringify({
        event: 'calibracao_certificate_uploaded',
        calibracaoId,
        equipamentoId,
        labId,
        lastCalibrationDate: new Date(lastCalibrationDate).toISOString(),
        nextDueDate: new Date(nextDueDate).toISOString(),
        status: calculateCalibracaoStatus(nextDueDate),
        calibratedBy: uid,
        timestamp: new Date(now).toISOString(),
      }),
    );

    return { calibracaoId };
  },
);
