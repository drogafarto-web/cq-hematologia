/**
 * trackSampleStatus — Callable to track submission status in NOTIVISA queue
 * Phase 4 — Polls portal for status updates, processes responses, updates submission records
 *
 * Input: { labId, requisitionId, authSessionId? }
 * Output: { ok, status, protocolNumber?, portalStatus?, updatedAt? }
 *
 * RDC 978 Art. 66 - Status tracking must maintain complete audit trail of state changes.
 * Returns latest status from queue without exposing internal implementation details.
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess } from '../validators';

const trackSampleStatusInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  requisitionId: z.string().min(1, 'requisitionId required'),
  authSessionId: z.string().optional(),
});

const trackSampleStatusOutputSchema = z.object({
  ok: z.literal(true),
  status: z.enum([
    'queued',
    'submitted',
    'acknowledged',
    'processing',
    'completed',
    'failed',
    'rejected',
  ]),
  protocolNumber: z.string().optional(),
  portalStatus: z.string().optional(),
  updatedAt: z.number().int(),
  nextCheckAt: z.number().int().optional(),
  errorMessage: z.string().optional(),
  details: z
    .object({
      attempts: z.number().int().optional(),
      maxAttempts: z.number().int().optional(),
      lastAttemptAt: z.number().int().optional(),
      response: z.record(z.any()).optional(),
    })
    .optional(),
});

const trackSampleStatusErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'REQUISITION_NOT_FOUND',
    'SESSION_INVALID',
    'SESSION_EXPIRED',
    'PERMISSION_DENIED',
    'PORTAL_ERROR',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type TrackSampleStatusInput = z.infer<typeof trackSampleStatusInputSchema>;
type TrackSampleStatusOutput = z.infer<typeof trackSampleStatusOutputSchema>;
type TrackSampleStatusError = z.infer<typeof trackSampleStatusErrorSchema>;

const POLLING_INTERVAL_MS = 300000; // 5 minutes
const MAX_POLLING_DURATION_MS = 86400000; // 24 hours

export const trackSampleStatus = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<TrackSampleStatusOutput | TrackSampleStatusError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = trackSampleStatusInputSchema.parse(request.data);
      const { labId, requisitionId, authSessionId } = input;
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
      const now = Date.now();

      // ========== 3. Fetch submission record ==========
      const submissionSnap = await db
        .collection('notivisa-requisitions')
        .doc(labId)
        .collection('submissions')
        .doc(requisitionId)
        .get();

      if (!submissionSnap.exists) {
        return {
          ok: false,
          code: 'REQUISITION_NOT_FOUND',
          message: `Requisition ${requisitionId} not found`,
        };
      }

      const submissionData = submissionSnap.data();

      // ========== 4. Validate session if provided ==========
      if (authSessionId) {
        const sessionSnap = await db
          .collection('notivisa-sessions')
          .doc(labId)
          .collection('sessions')
          .doc(authSessionId)
          .get();

        if (!sessionSnap.exists) {
          return {
            ok: false,
            code: 'SESSION_INVALID',
            message: 'Session not found',
          };
        }

        const sessionData = sessionSnap.data();
        if (sessionData.expiresAt < now) {
          return {
            ok: false,
            code: 'SESSION_EXPIRED',
            message: 'Session has expired',
          };
        }
      }

      // ========== 5. Check if polling should continue ==========
      const submittedAt = submissionData.submittedAt || now;
      const pollingDuration = now - submittedAt;

      let currentStatus = submissionData.status;
      let shouldStopPolling = false;

      // Terminal states - no need to poll further
      if (['completed', 'failed', 'rejected'].includes(currentStatus)) {
        shouldStopPolling = true;
      }

      // Polling timeout - give up after 24 hours
      if (pollingDuration > MAX_POLLING_DURATION_MS) {
        shouldStopPolling = true;
        if (currentStatus !== 'completed') {
          currentStatus = 'failed';
        }
      }

      // ========== 6. If not terminal, poll portal for updates ==========
      let portalResponse: any = null;
      let updatedStatus = currentStatus;

      if (!shouldStopPolling) {
        try {
          portalResponse = await pollNotivisaPortal(
            labId,
            submissionData.protocolNumber || requisitionId,
          );

          if (portalResponse.success && portalResponse.status) {
            updatedStatus = mapPortalStatus(portalResponse.status);
          }
        } catch (error: any) {
          functions.logger.warn('[trackSampleStatus] Portal polling error:', error);
          // Continue with last known status - don't fail the request
        }
      }

      // ========== 7. Update submission record if status changed ==========
      const statusChanged = updatedStatus !== currentStatus;

      if (statusChanged || portalResponse) {
        const batch = db.batch();
        const submissionRef = submissionSnap.ref;

        // Update submission
        const updateData: any = {
          status: updatedStatus,
          updatedAt: now,
          lastCheckAt: now,
        };

        if (portalResponse?.protocolNumber) {
          updateData.protocolNumber = portalResponse.protocolNumber;
        }

        if (portalResponse?.response) {
          updateData.lastPortalResponse = portalResponse.response;
        }

        if (!shouldStopPolling && updatedStatus !== 'completed') {
          updateData.nextCheckAt = now + POLLING_INTERVAL_MS;
        }

        batch.update(submissionRef, updateData);

        // Log status change
        if (statusChanged) {
          batch.set(submissionRef.collection('auditLog').doc(`${now}`), {
            action: 'STATUS_UPDATED',
            operatorId: uid,
            ts: now,
            fromStatus: currentStatus,
            toStatus: updatedStatus,
            portalStatus: portalResponse?.status || null,
            details: {
              pollingDuration,
              isTerminal: shouldStopPolling,
            },
          });
        }

        await batch.commit();
      }

      // ========== 8. Return current status ==========
      const responseData: any = {
        ok: true,
        status: updatedStatus,
        protocolNumber: submissionData.protocolNumber,
        portalStatus: portalResponse?.status,
        updatedAt: submissionData.updatedAt || submittedAt,
      };

      if (!shouldStopPolling) {
        responseData.nextCheckAt = now + POLLING_INTERVAL_MS;
      }

      if (portalResponse?.errorMessage) {
        responseData.errorMessage = portalResponse.errorMessage;
      }

      if (portalResponse || submissionData.attempts) {
        responseData.details = {
          attempts: submissionData.attempts || 0,
          maxAttempts: submissionData.maxAttempts || 5,
          lastAttemptAt: submissionData.lastCheckAt || submittedAt,
        };
      }

      // Log status check
      functions.logger.info('[NOTIVISA] Status tracked', {
        labId,
        uid,
        requisitionId,
        status: updatedStatus,
        statusChanged,
      });

      return responseData;
    } catch (error: any) {
      functions.logger.error('[trackSampleStatus] Error:', error);

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
        message: error.message || 'Internal error tracking sample status',
      };
    }
  });

/**
 * Poll NOTIVISA portal for status updates
 * In production, would call actual government API
 */
async function pollNotivisaPortal(
  labId: string,
  protocolNumber: string,
): Promise<{
  success: boolean;
  status?: string;
  protocolNumber?: string;
  response?: Record<string, any>;
  errorMessage?: string;
}> {
  try {
    // Mock implementation for sandbox
    // In production, would GET /api/v1/notificacoes/{protocolNumber} from NOTIVISA

    // Simulate varying response times
    const responses = [
      {
        success: true,
        status: 'submitted',
        protocolNumber,
        response: {
          timestamp: Date.now(),
          acknowledgment: true,
        },
      },
      {
        success: true,
        status: 'processing',
        protocolNumber,
        response: {
          timestamp: Date.now(),
          processingStatus: 'in_progress',
        },
      },
      {
        success: true,
        status: 'completed',
        protocolNumber,
        response: {
          timestamp: Date.now(),
          result: 'accepted',
          completedAt: Date.now(),
        },
      },
    ];

    // Simulate gradual status progression
    const randomChoice = Math.random();
    const selectedResponse =
      randomChoice < 0.3 ? responses[0] : randomChoice < 0.7 ? responses[1] : responses[2];

    return selectedResponse;
  } catch (error: any) {
    functions.logger.error('[pollNotivisaPortal] Error:', error);
    return {
      success: false,
      status: 'unknown',
      errorMessage: error.message,
    };
  }
}

/**
 * Map portal status codes to internal status enum
 */
function mapPortalStatus(portalStatus: string): string {
  const statusMap: Record<string, string> = {
    submitted: 'submitted',
    acknowledged: 'acknowledged',
    in_progress: 'processing',
    processing: 'processing',
    completed: 'completed',
    accepted: 'completed',
    rejected: 'rejected',
    failed: 'failed',
    error: 'failed',
  };

  return statusMap[portalStatus.toLowerCase()] || 'queued';
}
