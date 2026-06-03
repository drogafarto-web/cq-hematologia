/**
 * submitRequisition — Callable to submit NOTIVISA requisition to government portal
 * Phase 4 — Validates payload, submits to NOTIVISA API, enqueues polling, stores receipt
 *
 * Input: { labId, pacienteCpf, laudoId, authSessionId, notivisaPayload }
 * Output: { ok, requisitionId, status, protocolNumber?, nextCheckAt? }
 *
 * RDC 978 Art. 66 - Requisition submission must be cryptographically signed and audited.
 * Stores submission records in notivisa-requisitions/{labId}/submissions/{submissionId}
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess } from '../validators';
import { notivisaPayloadSchema } from '../../../shared/notivisa';

const submitRequisitionInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  pacienteCpf: z.string().regex(/^\d{11}$/, 'CPF must be 11 digits'),
  laudoId: z.string().min(1, 'laudoId required'),
  authSessionId: z.string().min(1, 'authSessionId required'),
  notivisaPayload: notivisaPayloadSchema,
});

const submitRequisitionOutputSchema = z.object({
  ok: z.literal(true),
  requisitionId: z.string(),
  status: z.enum(['queued', 'submitted', 'acknowledged']),
  protocolNumber: z.string().optional(),
  nextCheckAt: z.number().int().optional(),
});

const submitRequisitionErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'INVALID_SESSION',
    'SESSION_EXPIRED',
    'INVALID_PAYLOAD',
    'DUPLICATE_SUBMISSION',
    'PORTAL_ERROR',
    'RATE_LIMITED',
    'PERMISSION_DENIED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type SubmitRequisitionInput = z.infer<typeof submitRequisitionInputSchema>;
type SubmitRequisitionOutput = z.infer<typeof submitRequisitionOutputSchema>;
type SubmitRequisitionError = z.infer<typeof submitRequisitionErrorSchema>;

const POLLING_INTERVAL_MS = 300000; // 5 minutes
const RATE_LIMIT_PER_HOUR = 20;

export const submitRequisition = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<SubmitRequisitionOutput | SubmitRequisitionError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = submitRequisitionInputSchema.parse(request.data);
      const { labId, pacienteCpf, laudoId, authSessionId, notivisaPayload } = input;
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

      // ========== 3. Validate session ==========
      const sessionSnap = await db
        .collection('notivisa-sessions')
        .doc(labId)
        .collection('sessions')
        .doc(authSessionId)
        .get();

      if (!sessionSnap.exists) {
        return {
          ok: false,
          code: 'INVALID_SESSION',
          message: 'Session not found',
        };
      }

      const sessionData = sessionSnap.data();
      const now = Date.now();

      if (sessionData.expiresAt < now) {
        return {
          ok: false,
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        };
      }

      if (sessionData.status !== 'active') {
        return {
          ok: false,
          code: 'INVALID_SESSION',
          message: 'Session is not active',
        };
      }

      // ========== 4. Check for duplicate submission ==========
      const existingSubmissionSnap = await db
        .collection('notivisa-requisitions')
        .doc(labId)
        .collection('submissions')
        .where('laudoId', '==', laudoId)
        .where('pacienteCpf', '==', pacienteCpf)
        .where('status', 'in', ['submitted', 'acknowledged', 'completed'])
        .limit(1)
        .get();

      if (!existingSubmissionSnap.empty) {
        const existing = existingSubmissionSnap.docs[0].data();
        return {
          ok: false,
          code: 'DUPLICATE_SUBMISSION',
          message: `Requisition already submitted (requisitionId: ${existing.id})`,
        };
      }

      // ========== 5. Rate limiting check ==========
      const oneHourAgo = now - 3600000;
      const recentSubmissions = await db
        .collection('notivisa-requisitions')
        .doc(labId)
        .collection('submissions')
        .where('submittedAt', '>=', oneHourAgo)
        .count()
        .get();

      if (recentSubmissions.data().count >= RATE_LIMIT_PER_HOUR) {
        return {
          ok: false,
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded (${RATE_LIMIT_PER_HOUR} submissions per hour)`,
        };
      }

      // ========== 6. Payload validation ==========
      try {
        notivisaPayloadSchema.parse(notivisaPayload);
      } catch (error: any) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: `Payload validation failed: ${error.message}`,
        };
      }

      // ========== 7. Submit to NOTIVISA portal ==========
      let protocolNumber: string | undefined;
      let portalStatus = 'queued';

      try {
        const submitResult = await submitToNotivisaPortal(
          labId,
          sessionData.authToken,
          notivisaPayload,
        );

        if (submitResult.success) {
          protocolNumber = submitResult.protocolNumber;
          portalStatus = 'submitted';
        } else {
          functions.logger.warn('[submitRequisition] Portal submission failed:', {
            labId,
            error: submitResult.error,
          });
          portalStatus = 'queued'; // Queue for retry
        }
      } catch (error: any) {
        functions.logger.error('[submitRequisition] Portal communication error:', error);
        return {
          ok: false,
          code: 'PORTAL_ERROR',
          message: 'Failed to communicate with NOTIVISA portal',
        };
      }

      // ========== 8. Create submission record ==========
      const requisitionId = db.collection('dummy').doc().id;
      const submittedAt = now;
      const nextCheckAt = now + POLLING_INTERVAL_MS;

      const batch = db.batch();

      // Create submission record
      const submissionRef = db
        .collection('notivisa-requisitions')
        .doc(labId)
        .collection('submissions')
        .doc(requisitionId);

      batch.set(submissionRef, {
        id: requisitionId,
        labId,
        laudoId,
        pacienteCpf,
        status: portalStatus,
        protocolNumber: protocolNumber || null,
        payload: notivisaPayload,
        submittedBy: uid,
        submittedAt,
        nextCheckAt,
        attempts: 1,
        maxAttempts: 5,
        createdAt: now,
        updatedAt: now,
      });

      // Create audit log entry
      batch.set(submissionRef.collection('auditLog').doc(`${now}`), {
        action: 'SUBMITTED',
        operatorId: uid,
        ts: now,
        status: portalStatus,
        protocolNumber: protocolNumber || null,
        details: {
          sessionId: authSessionId,
          payloadHash: hashPayload(notivisaPayload),
        },
      });

      // Update session last activity
      batch.update(
        db.collection('notivisa-sessions').doc(labId).collection('sessions').doc(authSessionId),
        {
          lastActivityAt: now,
          lastSubmissionId: requisitionId,
        },
      );

      await batch.commit();

      // Log to Cloud Logs
      functions.logger.info('[NOTIVISA] Requisition submitted', {
        labId,
        uid,
        requisitionId,
        status: portalStatus,
        protocolNumber,
      });

      return {
        ok: true,
        requisitionId,
        status: portalStatus as 'queued' | 'submitted' | 'acknowledged',
        protocolNumber,
        nextCheckAt,
      };
    } catch (error: any) {
      functions.logger.error('[submitRequisition] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INVALID_PAYLOAD',
          message: `Validation error: ${error.errors[0].message}`,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error submitting requisition',
      };
    }
  });

/**
 * Submit requisition to NOTIVISA portal API
 * In production, would call actual government API with authentication
 */
async function submitToNotivisaPortal(
  labId: string,
  authToken: string,
  payload: any,
): Promise<{
  success: boolean;
  protocolNumber?: string;
  error?: string;
}> {
  try {
    // Mock implementation for sandbox
    // In production, would make authenticated HTTPS call to NOTIVISA API
    // e.g., POST /api/v1/notificacoes with authToken in header

    const protocolNumber = `NV-${labId}-${Date.now()}`;

    // Simulate occasional failures for robust error handling
    const shouldFail = Math.random() < 0.05; // 5% failure rate for testing

    if (shouldFail) {
      return {
        success: false,
        error: 'Portal temporarily unavailable',
      };
    }

    return {
      success: true,
      protocolNumber,
    };
  } catch (error: any) {
    functions.logger.error('[submitToNotivisaPortal] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate hash of payload for audit trail
 */
function hashPayload(payload: any): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').substring(0, 16);
}
