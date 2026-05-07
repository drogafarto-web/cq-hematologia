/**
 * rejectNotivisaDraft — RT marks draft as rejected with reason
 * Phase 8 — Prevents submission and notifies for investigation
 *
 * Input: { labId, draftId, reason, signature }
 * Output: { ok, draftId, status, rejectionReason }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { LogicalSignature, verifyLogicalSignature } from '../../../shared/cryptoaudit';

const rejectNotivisaDraftInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  draftId: z.string().min(1, 'draftId required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason max 500 chars'),
  signature: z.object({
    hash: z.string().length(64),
    operatorId: z.string().min(1),
    ts: z.number().int().positive(),
  }),
});

const rejectNotivisaDraftOutputSchema = z.object({
  ok: z.literal(true),
  draftId: z.string(),
  status: z.literal('rejected'),
  rejectionReason: z.string(),
});

const rejectNotivisaDraftErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'DRAFT_NOT_FOUND',
    'DRAFT_ALREADY_SUBMITTED',
    'SIGNATURE_INVALID',
    'PERMISSION_DENIED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type RejectNotivisaDraftInput = z.infer<typeof rejectNotivisaDraftInputSchema>;
type RejectNotivisaDraftOutput = z.infer<typeof rejectNotivisaDraftOutputSchema>;
type RejectNotivisaDraftError = z.infer<typeof rejectNotivisaDraftErrorSchema>;

export const rejectNotivisaDraft = functions.region('southamerica-east1').onCall(
  async (request): Promise<RejectNotivisaDraftOutput | RejectNotivisaDraftError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = rejectNotivisaDraftInputSchema.parse(request.data);
      const { labId, draftId, reason, signature } = input;
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
        throw new functions.https.HttpsError(
          'permission-denied',
          `User is not a member of lab ${labId}`
        );
      }

      const memberRole = memberDoc.data()?.role;
      const isRTOrAuditor = memberRole === 'RT' || memberRole === 'AUDITOR' || memberRole === 'admin';
      if (!isRTOrAuditor) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: `User role ${memberRole} cannot reject NOTIVISA drafts (requires RT or AUDITOR)`,
        };
      }

      // ========== 3. Fetch draft ==========
      const draftRef = db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .doc(draftId);

      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) {
        return {
          ok: false,
          code: 'DRAFT_NOT_FOUND',
          message: `Draft ${draftId} not found`,
        };
      }

      const draftData = draftSnap.data();
      if (!draftData) {
        return {
          ok: false,
          code: 'DRAFT_NOT_FOUND',
          message: 'Draft data is empty',
        };
      }

      // Check if already submitted
      if (draftData.status === 'submitted' || draftData.submittedAt) {
        return {
          ok: false,
          code: 'DRAFT_ALREADY_SUBMITTED',
          message: 'Cannot reject a draft that has already been submitted',
        };
      }

      // ========== 4. Verify signature ==========
      const payloadToSign = {
        reason,
        draftId,
      };

      const isValid = verifyLogicalSignature(signature as LogicalSignature, payloadToSign);
      if (!isValid || signature.operatorId !== uid) {
        return {
          ok: false,
          code: 'SIGNATURE_INVALID',
          message: 'Signature verification failed',
        };
      }

      // ========== 5. Update draft ==========
      const now = Date.now();

      const batch = db.batch();

      // Update draft
      batch.update(draftRef, {
        status: 'rejected',
        rejectionReason: reason,
        rejectedBy: uid,
        rejectedAt: now,
        updatedAt: now,
      });

      // Create audit log
      batch.set(
        draftRef.collection('auditLog').doc(`${now}`),
        {
          action: 'REJECTED',
          operatorId: uid,
          ts: now,
          details: {
            reason,
            signature: {
              hash: signature.hash,
              ts: signature.ts,
            },
          },
        }
      );

      await batch.commit();

      // Log to Cloud Logs
      functions.logger.info(`[NOTIVISA] Draft ${draftId} rejected by ${uid}`, {
        labId,
        draftId,
        reason: reason.substring(0, 100), // Log first 100 chars
      });

      return {
        ok: true,
        draftId,
        status: 'rejected',
        rejectionReason: reason,
      };
    } catch (error: any) {
      functions.logger.error('[rejectNotivisaDraft] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: error.errors[0].message,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error rejecting draft',
      };
    }
  }
);
