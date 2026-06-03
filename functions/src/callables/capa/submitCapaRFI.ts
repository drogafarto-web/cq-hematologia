/**
 * submitCapaRFI — Cloud Function callable v2 for auditor RFI submission
 * Phase 8 Wave 3 — SA-22
 *
 * Submits a Request For Information (RFI) to the lab regarding CAPA evidence.
 * Appends to rfiLog and auditLog.
 *
 * Input: { labId, capaId, question, dueDate }
 * Output: { rfiId }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const submitCapaRFIInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  capaId: z.string().min(1, 'capaId required'),
  question: z
    .string()
    .min(10, 'question must be at least 10 characters')
    .max(2000, 'question max 2000 characters'),
  dueDate: z
    .number()
    .int()
    .refine((d) => d > Date.now(), 'dueDate must be in the future'),
});

export interface SubmitCapaRFIOutput {
  rfiId: string;
}

export const submitCapaRFI = onCall<
  { labId: string; capaId: string; question: string; dueDate: number },
  Promise<SubmitCapaRFIOutput>
>({ region: 'southamerica-east1', cors: true }, async (request): Promise<SubmitCapaRFIOutput> => {
  // ========== 1. Validate request ==========
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const input = submitCapaRFIInputSchema.parse(request.data);
  const { labId, capaId, question, dueDate } = input;
  const uid = request.auth.uid;

  const db = admin.firestore();

  // ========== 2. Authorization check ==========
  const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

  if (!memberDoc.exists) {
    throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
  }

  const memberRole = memberDoc.data()?.role;
  if (!['AUDITOR', 'admin', 'owner'].includes(memberRole)) {
    throw new HttpsError('permission-denied', 'Only AUDITOR or admin can submit RFI');
  }

  // ========== 3. Fetch current CAPA ==========
  const capaRef = db.collection('labs').doc(labId).collection('capa-tracking').doc(capaId);

  const capaSnap = await capaRef.get();

  if (!capaSnap.exists) {
    throw new HttpsError('not-found', `CAPA ${capaId} not found`);
  }

  const capaData = capaSnap.data();

  if (capaData?.deletedAt !== undefined && capaData.deletedAt !== null) {
    throw new HttpsError('invalid-argument', 'Cannot submit RFI for deleted CAPA');
  }

  // ========== 4. Append RFI to log ==========
  const rfiId = uuid();
  const now = Date.now();

  const newRFI = {
    rfiId,
    question,
    askedBy: uid,
    askedAt: now,
    dueDate,
    status: 'pending' as const,
  };

  const rfiLog = capaData?.rfiLog || [];
  rfiLog.push(newRFI);

  // ========== 5. Append audit log entry ==========
  const auditLog = capaData?.auditLog || [];
  auditLog.push({
    action: 'rfi-submitted',
    performedBy: uid,
    performedAt: now,
    details: { rfiId, questionLength: question.length },
  });

  // ========== 6. Update CAPA ==========
  await capaRef.update({
    rfiLog,
    auditLog,
  });

  // ========== 7. Log to Cloud Logs ==========
  console.log(
    JSON.stringify({
      event: 'rfi_submitted',
      capaId,
      rfiId,
      labId,
      askedBy: uid,
      dueDate: new Date(dueDate).toISOString(),
      timestamp: new Date(now).toISOString(),
    }),
  );

  // TODO: Email notification to lab (future implementation)

  return { rfiId };
});
