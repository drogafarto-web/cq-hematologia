/**
 * notivisaSoftDelete — Soft delete NOTIVISA entry with audit trail
 * Phase 8+ — Per RN-06 (soft delete only)
 *
 * Admin/supervisor can mark NOTIVISA entry as deleted (status='deleted'),
 * preserves audit trail immutably, records deletion reason.
 *
 * Per ADR-0026 + RN-06: never hard delete; append-only audit;
 * soft delete sets deletedAt + deletedBy + reason.
 *
 * Input: { labId, entryId, reason }
 * Output: { ok, entryId, deletedAt, deletedBy }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const notivisaSoftDeleteInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  entryId: z.string().min(1, 'entryId required'),
  reason: z.enum(['duplicate', 'incorrect-patient', 'false-positive', 'test-entry', 'other']),
  notes: z.string().max(500).optional(),
});

const notivisaSoftDeleteOutputSchema = z.object({
  ok: z.literal(true),
  entryId: z.string(),
  deletedAt: z.number().int(),
  deletedBy: z.string(),
});

const notivisaSoftDeleteErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'UNAUTHORIZED',
    'ENTRY_NOT_FOUND',
    'ENTRY_ALREADY_DELETED',
    'ALREADY_SUBMITTED',
    'INVALID_PAYLOAD',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type NotivisaSoftDeleteOutput = z.infer<typeof notivisaSoftDeleteOutputSchema>;
type NotivisaSoftDeleteError = z.infer<typeof notivisaSoftDeleteErrorSchema>;

/**
 * Soft delete callable
 */
export const notivisaSoftDelete = onCall(
  { region: 'southamerica-east1' },
  async (request): Promise<NotivisaSoftDeleteOutput | NotivisaSoftDeleteError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = notivisaSoftDeleteInputSchema.parse(request.data);
      const { labId, entryId, reason, notes } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization: admin only ==========
      const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

      if (!memberDoc.exists) {
        return {
          ok: false,
          code: 'UNAUTHORIZED',
          message: `User is not a member of lab ${labId}`,
        };
      }

      const memberRole = memberDoc.data()?.role;
      const isAdmin = memberRole === 'admin' || memberRole === 'owner';

      if (!isAdmin) {
        return {
          ok: false,
          code: 'UNAUTHORIZED',
          message: `User role ${memberRole} cannot delete NOTIVISA entries (requires admin or owner)`,
        };
      }

      // ========== 3. Fetch entry ==========
      const entryRef = db.collection(`labs/${labId}/notivisa-outbox`).doc(entryId);

      const entrySnap = await entryRef.get();

      if (!entrySnap.exists) {
        return {
          ok: false,
          code: 'ENTRY_NOT_FOUND',
          message: `Entry ${entryId} not found in lab ${labId}`,
        };
      }

      const entryData = entrySnap.data();
      if (!entryData) {
        return {
          ok: false,
          code: 'ENTRY_NOT_FOUND',
          message: 'Entry data is empty',
        };
      }

      // ========== 4. Check if already deleted ==========
      if (entryData.deletedAt || entryData.status === 'deleted') {
        return {
          ok: false,
          code: 'ENTRY_ALREADY_DELETED',
          message: `Entry ${entryId} is already deleted (at ${entryData.deletedAt})`,
        };
      }

      // ========== 5. Check if already submitted to Anvisa ==========
      // Allow deletion of submitted entries (audit trail preserved)
      // but warn in logs
      const isSubmitted = entryData.status === 'submitted' || entryData.status === 'acknowledged';
      if (isSubmitted) {
        functions.logger.warn(`[NOTIVISA] Deleting already-submitted entry ${entryId}`, {
          labId,
          reason,
          previousStatus: entryData.status,
          receiptCode: entryData.receiptCodeFromAnvisa || 'none',
        });
      }

      // ========== 6. Soft delete ==========
      const now = Date.now();
      const batch = db.batch();

      // Update entry with deletion metadata
      batch.update(entryRef, {
        status: 'deleted',
        deletedAt: now,
        deletedBy: uid,
        deletionReason: reason,
        deletionNotes: notes || null,
        // Keep all previous fields immutable
      });

      // Create deletion audit log entry
      batch.set(entryRef.collection('auditLog').doc(`deletion-${now}`), {
        action: 'SOFT_DELETED',
        operatorId: uid,
        ts: now,
        details: {
          reason,
          notes: notes || null,
          previousStatus: entryData.status,
          submissionAttempts: entryData.submissionAttempts?.length ?? 0,
          receiptCode: entryData.receiptCodeFromAnvisa || null,
        },
      });

      await batch.commit();

      // ========== 7. Log deletion ==========
      functions.logger.info(`[NOTIVISA] Entry soft-deleted: ${entryId}`, {
        labId,
        reason,
        deletedBy: uid,
        wasSubmitted: isSubmitted,
      });

      return {
        ok: true,
        entryId,
        deletedAt: now,
        deletedBy: uid,
      };
    } catch (error: any) {
      functions.logger.error('[notivisaSoftDelete] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: error.errors[0].message,
        };
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error during deletion',
      };
    }
  },
);
