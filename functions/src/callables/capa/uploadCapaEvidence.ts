/**
 * uploadCapaEvidence — Cloud Function callable v2 for evidence file registration
 * Phase 8 Wave 3 — SA-23
 *
 * Registers evidence file metadata after upload to Firebase Storage.
 * Validates hash format, file size, and CAPA state.
 * Validates signature matches request.auth.uid.
 * Appends to evidence array and auditLog.
 *
 * Input: { labId, capaId, fileName, fileSize, mimeType, storagePath, hash, signature, description? }
 * Output: { evidenceId }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const logicalSignatureSchema = z.object({
  hash: z
    .string()
    .length(64, 'hash must be 64 hex characters')
    .regex(/^[a-f0-9]{64}$/),
  operatorId: z.string().min(1),
  ts: z.number().int(),
});

const uploadCapaEvidenceInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  capaId: z.string().min(1, 'capaId required'),
  fileName: z.string().min(1, 'fileName required'),
  fileSize: z.number().int().max(10_485_760, 'File size max 10MB'),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']),
  storagePath: z.string().min(1, 'storagePath required'),
  hash: z
    .string()
    .length(64, 'hash must be 64 hex characters')
    .regex(/^[a-f0-9]{64}$/),
  signature: logicalSignatureSchema,
  description: z.string().optional(),
});

export interface UploadCapaEvidenceOutput {
  evidenceId: string;
}

export const uploadCapaEvidence = onCall<
  z.infer<typeof uploadCapaEvidenceInputSchema>,
  Promise<UploadCapaEvidenceOutput>
>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<UploadCapaEvidenceOutput> => {
    // ========== 1. Validate request ==========
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = uploadCapaEvidenceInputSchema.parse(request.data);
    const {
      labId,
      capaId,
      fileName,
      fileSize,
      mimeType,
      storagePath,
      hash,
      signature,
      description,
    } = input;
    const uid = request.auth.uid;

    // ========== 2. Validate signature operatorId matches request.auth.uid ==========
    if (signature.operatorId !== uid) {
      throw new HttpsError(
        'invalid-argument',
        'Signature operatorId must match authenticated user',
      );
    }

    const db = admin.firestore();

    // ========== 3. Authorization check ==========
    const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

    if (!memberDoc.exists) {
      throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
    }

    // ========== 4. Fetch current CAPA ==========
    const capaRef = db.collection('labs').doc(labId).collection('capa-tracking').doc(capaId);

    const capaSnap = await capaRef.get();

    if (!capaSnap.exists) {
      throw new HttpsError('not-found', `CAPA ${capaId} not found`);
    }

    const capaData = capaSnap.data();

    if (capaData?.deletedAt !== undefined && capaData.deletedAt !== null) {
      throw new HttpsError('invalid-argument', 'Cannot upload evidence for deleted CAPA');
    }

    // ========== 5. Validate CAPA state (reject if closed) ==========
    if (capaData?.state === 'closed') {
      throw new HttpsError('invalid-argument', 'Cannot upload evidence for closed CAPA');
    }

    // ========== 6. Create evidence record ==========
    const evidenceId = uuid();
    const now = Date.now();

    const evidence = {
      id: evidenceId,
      labId,
      capaId,
      fileName,
      fileSize,
      mimeType,
      storagePath,
      uploadedBy: uid,
      uploadedAt: now,
      hash, // Never log the file content, only the hash
      signature,
      description,
    };

    // ========== 7. Append evidence and audit log ==========
    const evidenceList = capaData?.evidence || [];
    evidenceList.push(evidence);

    const auditLog = capaData?.auditLog || [];
    auditLog.push({
      action: 'evidence-upload',
      performedBy: uid,
      performedAt: now,
      details: {
        evidenceId,
        fileName,
        fileSize,
        mimeType,
      },
    });

    // ========== 8. Update CAPA ==========
    await capaRef.update({
      evidence: evidenceList,
      auditLog,
    });

    // ========== 9. Log to Cloud Logs (never log full content) ==========
    console.log(
      JSON.stringify({
        event: 'evidence_uploaded',
        capaId,
        evidenceId,
        labId,
        fileName,
        fileSize,
        hash, // Log hash for traceability
        uploadedBy: uid,
        timestamp: new Date(now).toISOString(),
      }),
    );

    return { evidenceId };
  },
);
