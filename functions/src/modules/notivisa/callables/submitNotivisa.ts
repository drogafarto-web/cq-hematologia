/**
 * submitNotivisa — Callable for NOTIVISA draft submission to queue
 * Phase 8 — RDC 978 Art. 66 compliance
 *
 * Validates RT approval, enqueues notification for async transmission,
 * and returns queue event ID for polling.
 *
 * Input: { labId, draftId, rtApprovalSignature?, idempotencyToken? }
 * Output: { ok, eventId, status, pacienteCpf, nextPollAt? }
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { LogicalSignature, verifyLogicalSignature } from '../../../shared/cryptoaudit';

const submitNotivisaInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  draftId: z.string().min(1, 'draftId required'),
  rtApprovalSignature: z
    .object({
      hash: z.string().length(64, 'hash must be 64-char hex'),
      operatorId: z.string().min(1),
      ts: z.number().int().positive(),
    })
    .optional(),
  idempotencyToken: z.string().uuid().optional(),
});

const submitNotivisaOutputSchema = z.object({
  ok: z.literal(true),
  eventId: z.string(),
  status: z.literal('pending'),
  pacienteCpf: z.string(),
  nextPollAt: z.number().int().optional(),
});

const submitNotivisaErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'DRAFT_NOT_FOUND',
    'DRAFT_ALREADY_SUBMITTED',
    'INVALID_PAYLOAD',
    'RT_APPROVAL_REQUIRED',
    'APPROVAL_SIGNATURE_INVALID',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type SubmitNotivisaInput = z.infer<typeof submitNotivisaInputSchema>;
type SubmitNotivisaOutput = z.infer<typeof submitNotivisaOutputSchema>;
type SubmitNotivisaError = z.infer<typeof submitNotivisaErrorSchema>;

const RATE_LIMIT_PER_HOUR = 10;
const POLL_INTERVAL_MS = 300000; // 5 minutes

export const submitNotivisa = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<SubmitNotivisaOutput | SubmitNotivisaError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = submitNotivisaInputSchema.parse(request.data);
      const { labId, draftId, rtApprovalSignature, idempotencyToken } = input;
      const uid = request.auth.uid;

      const db = admin.firestore();

      // ========== 2. Authorization check ==========
      const memberDoc = await db.collection('labs').doc(labId).collection('members').doc(uid).get();

      if (!memberDoc.exists) {
        throw new functions.https.HttpsError(
          'permission-denied',
          `User is not a member of lab ${labId}`,
        );
      }

      const memberRole = memberDoc.data()?.role;
      const isRTOrAuditor =
        memberRole === 'RT' || memberRole === 'AUDITOR' || memberRole === 'admin';
      if (!isRTOrAuditor) {
        throw new functions.https.HttpsError(
          'permission-denied',
          `User role ${memberRole} cannot submit NOTIVISA drafts (requires RT or AUDITOR)`,
        );
      }

      // ========== 3. Idempotency check ==========
      if (idempotencyToken) {
        const existingEvent = await db
          .collection('notivisa-queue')
          .doc(labId)
          .collection('events')
          .where('idempotencyToken', '==', idempotencyToken)
          .where('status', 'in', ['pending', 'sent', 'acknowledged'])
          .limit(1)
          .get();

        if (!existingEvent.empty) {
          const existingId = existingEvent.docs[0].id;
          const existingData = existingEvent.docs[0].data();
          return {
            ok: true,
            eventId: existingId,
            status: 'pending',
            pacienteCpf: existingData.pacienteCpf,
          };
        }
      }

      // ========== 4. Fetch and validate draft ==========
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
      if (draftData.status && draftData.status !== 'draft' && draftData.status !== 'approved') {
        return {
          ok: false,
          code: 'DRAFT_ALREADY_SUBMITTED',
          message: `Draft is already ${draftData.status}; cannot submit again`,
        };
      }

      // ========== 5. Verify RT signature (if required) ==========
      const config = await db
        .collection('labs')
        .doc(labId)
        .collection('notivisa-config')
        .doc('config')
        .get();

      const rtApprovalRequired = config.data()?.rtApprovalRequired ?? true;

      if (rtApprovalRequired && draftData.status === 'draft') {
        return {
          ok: false,
          code: 'RT_APPROVAL_REQUIRED',
          message: 'RT approval required before submission',
        };
      }

      if (rtApprovalSignature) {
        const isValid = verifyLogicalSignature(rtApprovalSignature as LogicalSignature, draftData);
        if (!isValid) {
          return {
            ok: false,
            code: 'APPROVAL_SIGNATURE_INVALID',
            message: 'Signature verification failed',
          };
        }
      }

      // ========== 6. Rate limiting check ==========
      const oneHourAgo = Date.now() - 3600000;
      const recentSubmissions = await db
        .collection('notivisa-queue')
        .doc(labId)
        .collection('events')
        .where('createdAt', '>=', oneHourAgo)
        .count()
        .get();

      if (recentSubmissions.data().count >= RATE_LIMIT_PER_HOUR) {
        return {
          ok: false,
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded (${RATE_LIMIT_PER_HOUR} submissions per hour)`,
        };
      }

      // ========== 7. Enqueue notification ==========
      const queueRef = db.collection('notivisa-queue').doc(labId).collection('events');

      const newEventId = queueRef.doc().id;
      const now = Date.now();
      const nextPollAt = now + POLL_INTERVAL_MS;

      const batch = db.batch();

      // Create queue event
      batch.set(queueRef.doc(newEventId), {
        id: newEventId,
        labId,
        draftId,
        pacienteCpf: draftData.payload?.paciente_cpf || '***',
        status: 'pending',
        attempts: 0,
        maxAttempts: config.data()?.maxRetries ?? 5,
        createdAt: now,
        updatedAt: now,
        nextRetry: now,
        idempotencyToken: idempotencyToken || null,
      });

      // Create audit log entry
      batch.set(draftRef.collection('auditLog').doc(`${now}`), {
        action: 'SUBMITTED',
        operatorId: uid,
        ts: now,
        details: {
          eventId: newEventId,
          pacienteCpf: draftData.payload?.paciente_cpf || '***',
          idempotencyToken: idempotencyToken || null,
        },
      });

      // Update draft status to submitted
      batch.update(draftRef, {
        status: 'submitted',
        submittedAt: now,
        submittedBy: uid,
      });

      await batch.commit();

      // Log to Cloud Logs
      functions.logger.info(`[NOTIVISA] Draft ${draftId} submitted to queue`, {
        labId,
        eventId: newEventId,
        operator: uid,
      });

      return {
        ok: true,
        eventId: newEventId,
        status: 'pending',
        pacienteCpf: draftData.payload?.paciente_cpf || '***',
        nextPollAt,
      };
    } catch (error: any) {
      functions.logger.error('[submitNotivisa] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: error.errors[0].message,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error during submission',
      };
    }
  });
