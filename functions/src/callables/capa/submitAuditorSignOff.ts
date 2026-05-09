/**
 * submitAuditorSignOff — Cloud Function callable v2 for auditor closure
 * Phase 8 Wave 3 — SA-24
 *
 * Submits auditor final sign-off, closing multiple CAPAs in batch.
 * For each capaId: validates state, transitions to 'closed', generates LogicalSignature.
 * Creates signOff record in labs/{labId}/auditor-signoffs/{signOffId}
 *
 * Input: { labId, auditorEmail, auditorName, auditorFirm, message, capaIds }
 * Output: { signOffId, closedAt }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const submitAuditorSignOffInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  auditorEmail: z.string().email('Invalid auditor email'),
  auditorName: z.string().min(1, 'auditorName required'),
  auditorFirm: z.string().min(1, 'auditorFirm required'),
  message: z.string().min(1, 'message required'),
  capaIds: z.array(z.string().min(1)),
});

export interface SubmitAuditorSignOffOutput {
  signOffId: string;
  closedAt: number;
}

export const submitAuditorSignOff = onCall<
  z.infer<typeof submitAuditorSignOffInputSchema>,
  Promise<SubmitAuditorSignOffOutput>
>(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<SubmitAuditorSignOffOutput> => {
    // ========== 1. Validate request ==========
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const input = submitAuditorSignOffInputSchema.parse(request.data);
    const { labId, auditorEmail, auditorName, auditorFirm, message, capaIds } = input;
    const uid = request.auth.uid;

    const db = admin.firestore();

    // ========== 2. Authorization check ==========
    const memberDoc = await db
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    if (!memberDoc.exists) {
      throw new HttpsError('permission-denied', `User is not a member of lab ${labId}`);
    }

    const memberRole = memberDoc.data()?.role;
    if (!['RT', 'admin', 'owner'].includes(memberRole)) {
      throw new HttpsError('permission-denied', 'Only RT or admin can submit sign-off');
    }

    // ========== 3. Batch update all CAPAs ==========
    const batch = db.batch();
    const now = Date.now();
    const signOffId = uuid();

    for (const capaId of capaIds) {
      const capaRef = db
        .collection('labs')
        .doc(labId)
        .collection('capa-tracking')
        .doc(capaId);

      const capaSnap = await capaRef.get();

      if (!capaSnap.exists) {
        throw new HttpsError('not-found', `CAPA ${capaId} not found`);
      }

      const capaData = capaSnap.data();

      // Skip already closed CAPAs
      if (capaData?.state === 'closed') {
        continue;
      }

      // Create new state history entry
      const stateHistory = capaData?.stateHistory || [];
      stateHistory.push({
        from: capaData?.state || 'open',
        to: 'closed' as const,
        transitionedAt: now,
        transitionedBy: uid,
        reason: `Auditor sign-off by ${auditorName}`,
      });

      // Create audit log entry
      const auditLog = capaData?.auditLog || [];
      auditLog.push({
        action: 'auditor-signoff',
        performedBy: uid,
        performedAt: now,
        details: {
          signOffId,
          auditorName,
          auditorEmail,
          auditorFirm,
        },
      });

      batch.update(capaRef, {
        state: 'closed' as const,
        stateHistory,
        auditLog,
        auditorSignOffEmail: auditorEmail,
        auditorSignOffAt: now,
      });
    }

    // ========== 4. Create sign-off record ==========
    const signOffPayload = {
      id: signOffId,
      labId,
      auditorEmail,
      auditorName,
      auditorFirm,
      message,
      capaIds,
      signedBy: uid,
      signedAt: now,
      deletedAt: undefined,
    };

    const signOffRef = db
      .collection('labs')
      .doc(labId)
      .collection('auditor-signoffs')
      .doc(signOffId);

    batch.set(signOffRef, signOffPayload);

    // ========== 5. Commit batch ==========
    await batch.commit();

    // ========== 6. Log to Cloud Logs ==========
    console.log(
      JSON.stringify({
        event: 'auditor_signoff',
        signOffId,
        labId,
        capaIds: capaIds.length,
        auditorName,
        auditorEmail,
        signedBy: uid,
        timestamp: new Date(now).toISOString(),
      }),
    );

    return {
      signOffId,
      closedAt: now,
    };
  }
);
