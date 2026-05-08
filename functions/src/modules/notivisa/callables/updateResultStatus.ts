/**
 * updateResultStatus — Callable to mark NOTIVISA result as reviewed/released
 * Phase 4 — Transitions submission from received to released (final release)
 *
 * Input: { labId, submissionId, action ('review' | 'release'), signature }
 * Output: { ok, submissionId, status, releasedAt?, releasedBy? }
 *
 * RDC 978 Art. 122 - Supervisor must review and release results.
 * DICQ 4.1.2.7 - Immutable audit trail of all state transitions.
 * Stores state change in notivisa-requisitions/{labId}/submissions/{submissionId}/auditLog
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess, LogicalSignatureSchema } from '../validators';

// ─── Input Schemas ──────────────────────────────────────────────────────────

const UpdateResultStatusInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  submissionId: z.string().min(1, 'submissionId required'),
  action: z.enum(['review', 'release'], {
    errorMap: () => ({ message: "action must be 'review' or 'release'" }),
  }),
  signature: LogicalSignatureSchema,
});

type UpdateResultStatusInput = z.infer<typeof UpdateResultStatusInputSchema>;

const UpdateResultStatusOutputSchema = z.object({
  ok: z.literal(true),
  submissionId: z.string(),
  status: z.enum(['received', 'reviewed', 'released']),
  releasedAt: z.number().int().optional(),
  releasedBy: z.string().optional(),
});

const UpdateResultStatusErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'SUBMISSION_NOT_FOUND',
    'INVALID_STATUS_TRANSITION',
    'INVALID_SIGNATURE',
    'PERMISSION_DENIED',
    'SUPERVISOR_ROLE_REQUIRED',
    'SUBMISSION_EXPIRED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type UpdateResultStatusOutput = z.infer<typeof UpdateResultStatusOutputSchema>;
type UpdateResultStatusError = z.infer<typeof UpdateResultStatusErrorSchema>;

// ─── State Transition Rules ──────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ['reviewed'],
  reviewed: ['released'],
  released: [], // Terminal state
};

const RESULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Main Callable ──────────────────────────────────────────────────────────

export const updateResultStatus = functions.region('southamerica-east1').onCall(
  async (request): Promise<UpdateResultStatusOutput | UpdateResultStatusError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated'
        );
      }

      const input = UpdateResultStatusInputSchema.parse(request.data);
      const { labId, submissionId, action, signature } = input;
      const uid = request.auth.uid;

      // ========== 2. Authorization check ==========
      try {
        await assertNotivisaAccess(request.auth, labId);
      } catch (error: any) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: error.message || 'User does not have NOTIVISA access',
        };
      }

      const db = admin.firestore();

      // ========== 3. Verify signature operatorId matches request UID ==========
      if (signature.operatorId !== uid) {
        functions.logger.warn('[updateResultStatus] Signature operatorId mismatch', {
          labId,
          submissionId,
          signatureUid: signature.operatorId,
          requestUid: uid,
        });
        return {
          ok: false,
          code: 'INVALID_SIGNATURE',
          message: 'Signature operatorId does not match authenticated user',
        };
      }

      // ========== 4. Check supervisor role (RT or admin) ==========
      const memberSnap = await db.doc(`labs/${labId}/members/${uid}`).get();
      if (!memberSnap.exists) {
        return {
          ok: false,
          code: 'SUPERVISOR_ROLE_REQUIRED',
          message: 'User must be a member of the lab',
        };
      }

      const memberData = memberSnap.data()!;
      const role = memberData['role'] as string | undefined;
      const isRT = role === 'RT' || role === 'SUPERVISOR';
      const isAdmin = role === 'admin' || role === 'owner';

      if (!isRT && !isAdmin) {
        return {
          ok: false,
          code: 'SUPERVISOR_ROLE_REQUIRED',
          message:
            'Only RT (Responsible Technician) or admin can review/release results',
        };
      }

      // ========== 5. Fetch submission ==========
      const submissionRef = db
        .collection('notivisa-requisitions')
        .doc(labId)
        .collection('submissions')
        .doc(submissionId);

      const submissionSnap = await submissionRef.get();
      if (!submissionSnap.exists) {
        return {
          ok: false,
          code: 'SUBMISSION_NOT_FOUND',
          message: 'Submission not found',
        };
      }

      const submissionData = submissionSnap.data()!;
      const currentStatus = submissionData['status'] as string;
      const createdAt = submissionData['createdAt'] as number;

      // ========== 6. Validate status transition ==========
      const validNextStates = VALID_TRANSITIONS[currentStatus] || [];
      let nextStatus: string;

      if (action === 'review') {
        nextStatus = 'reviewed';
      } else if (action === 'release') {
        nextStatus = 'released';
      } else {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: 'Invalid action state',
        };
      }

      if (!validNextStates.includes(nextStatus)) {
        return {
          ok: false,
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from ${currentStatus} to ${nextStatus}. Valid transitions: ${validNextStates.join(', ') || 'none (terminal state)'}`,
        };
      }

      // ========== 7. Check expiration (7 days from creation) ==========
      const now = Date.now();
      const ageMs = now - createdAt;
      if (ageMs > RESULT_EXPIRATION_MS) {
        return {
          ok: false,
          code: 'SUBMISSION_EXPIRED',
          message: 'Submission has expired (older than 7 days)',
        };
      }

      // ========== 8. Prepare audit log entry ==========
      const auditEntry = {
        id: `${now}`,
        action: `RESULT_${action.toUpperCase()}`,
        operator_id: uid,
        operator_role: role,
        previous_status: currentStatus,
        new_status: nextStatus,
        timestamp: now,
        ip_address: request.remoteAddress || 'unknown',
        comments: signature.ts === now ? 'same-timestamp-signature' : undefined,
      };

      // ========== 9. Atomic update: submission + audit log ==========
      const batch = db.batch();

      // Update submission status
      batch.update(submissionRef, {
        status: nextStatus,
        updatedAt: now,
        updatedBy: uid,
        ...(nextStatus === 'released' && {
          releasedAt: now,
          releasedBy: uid,
        }),
      });

      // Add immutable audit log entry
      const auditRef = submissionRef
        .collection('auditLog')
        .doc(auditEntry.id);
      batch.set(auditRef, auditEntry);

      // Add lab-wide audit trail entry
      const labAuditRef = db
        .collection('notivisa-audit-logs')
        .doc(labId)
        .collection('result-status-changes')
        .doc(auditEntry.id);
      batch.set(labAuditRef, {
        submissionId,
        ...auditEntry,
      });

      await batch.commit();

      // ========== 10. Log successful update ==========
      functions.logger.info('[updateResultStatus] Status updated', {
        labId,
        submissionId,
        uid,
        action,
        previousStatus: currentStatus,
        newStatus: nextStatus,
      });

      // ========== 11. Return success response ==========
      return {
        ok: true,
        submissionId,
        status: nextStatus as 'received' | 'reviewed' | 'released',
        ...(nextStatus === 'released' && {
          releasedAt: now,
          releasedBy: uid,
        }),
      };
    } catch (error: any) {
      functions.logger.error('[updateResultStatus] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: `Validation error: ${error.errors[0].message}`,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error updating result status',
      };
    }
  }
);
