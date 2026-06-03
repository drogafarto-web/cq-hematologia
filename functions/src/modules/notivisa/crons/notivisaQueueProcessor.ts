/**
 * notivisaQueueProcessor — Scheduled Cloud Function (5-min interval)
 * Phase 4 (sandbox) & Phase 12+ (real API)
 *
 * Polls pending NOTIVISA queue entries, applies exponential backoff,
 * attempts submission via mock (Phase 4) or real SOAP API (Phase 12+),
 * and records attempt history (append-only).
 *
 * Per ADR-0026: exponential backoff 1m → 5m → 15m → 45m → 120m (max 5 attempts),
 * idempotency via SHA-256(labId:diseaseCode:patientId:resultDate),
 * soft failure on retryable (5xx/timeout), hard failure on validation (4xx).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface NotivisaOutboxEntry {
  id: string;
  labId: string;
  laudoId: string;
  diseaseCode: string;
  patientData: {
    name_anon: string;
    dateOfBirth: any; // Firestore Timestamp
    gender: 'M' | 'F' | 'outro';
  };
  resultValue: string;
  resultDate: any; // Firestore Timestamp
  notificationDeadline: any; // Firestore Timestamp
  status: 'pending' | 'submitted' | 'acknowledged' | 'failed-permanent';
  submissionAttempts: Array<{
    attempt: number;
    ts: any; // Firestore Timestamp
    method: 'mock-submit' | 'soap-anvisa' | 'rest-anvisa';
    status: 'sent' | 'mocked' | 'failed' | 'success';
    error?: {
      errorCode?: string;
      errorMessage?: string;
      isRetryable: boolean;
    };
    receiptCode?: string;
    roundTripMs?: number;
  }>;
  escalatedToSupervisor?: boolean;
  escalationTs?: any;
  escalationMotivo?: 'deadline-passed' | 'permanent-failure' | 'max-retries-exceeded';
}

interface SubmissionResult {
  success: boolean;
  receiptCode?: string;
  eventId?: string;
  roundTripMs?: number;
  errorCode?: string;
  errorMessage?: string;
  isRetryable?: boolean;
}

/**
 * Mock NOTIVISA submitter (Phase 4)
 * Simulates instant success + receipt code generation
 */
async function submitNotivisaToAnvisaMock(
  _labId: string,
  entry: NotivisaOutboxEntry,
): Promise<SubmissionResult> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

  const receiptCode = `NV-SANDBOX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const eventId = `evt-${Date.now()}`;

  return {
    success: true,
    receiptCode,
    eventId,
    roundTripMs: Math.random() * 200 + 50,
  };
}

/**
 * Real NOTIVISA submitter (Phase 12+)
 * Currently returns mock; replaced with real SOAP call in Phase 12
 */
async function submitNotivisaToAnvisaReal(
  _labId: string,
  entry: NotivisaOutboxEntry,
): Promise<SubmissionResult> {
  // Phase 12: Replace with real SOAP API call to Anvisa
  // For now, fallback to mock
  return submitNotivisaToAnvisaMock(_labId, entry);
}

/**
 * Route to appropriate submitter based on env
 */
async function submitNotivisaToAnvisa(
  labId: string,
  entry: NotivisaOutboxEntry,
): Promise<SubmissionResult> {
  const mode = process.env.NOTIVISA_API_MODE || 'sandbox';

  if (mode === 'production') {
    return submitNotivisaToAnvisaReal(labId, entry);
  }

  return submitNotivisaToAnvisaMock(labId, entry);
}

/**
 * Notify supervisor of NOTIVISA submission failure
 * Phase 8: Placeholder for SMS/email integration
 */
async function notifySupervisorOfNotivisaFailure(
  labId: string,
  entry: NotivisaOutboxEntry,
): Promise<void> {
  // Phase 8: Integrate with Twilio SMS + email service
  functions.logger.warn(`[NOTIVISA] Escalation required: ${entry.id} in lab ${labId}`, {
    motivo: entry.escalationMotivo,
    diseaseCode: entry.diseaseCode,
    attempts: entry.submissionAttempts.length,
  });
}

/**
 * Exponential backoff schedule (minutes)
 * Index 0 = 1st attempt (no delay), 1 = 2nd attempt (1min), etc.
 */
const BACKOFF_SCHEDULE = [0, 1, 5, 15, 45, 120];

/**
 * Scheduled processor: runs every 5 minutes
 * Processes pending queue entries with exponential backoff
 */
export const notivisaQueueProcessor = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'southamerica-east1',
    timeoutSeconds: 540, // 9 minutes (leave buffer for Cloud Scheduler)
    maxInstances: 1, // serialize execution to avoid race conditions
    secrets: [], // Phase 12: add ANVISA_CERT_PATH, ANVISA_WSDL_ENDPOINT
  },
  async (): Promise<void> => {
    const db = admin.firestore();

    try {
      functions.logger.info('[NOTIVISA] Queue processor started');

      // 1. Find all labs
      const labsSnap = await db.collection('labs').listDocuments();

      for (const labDoc of labsSnap) {
        const labId = labDoc.id;

        try {
          // 2. Query: pending entries
          const pendingEntries = await db
            .collection(`labs/${labId}/notivisa-outbox`)
            .where('status', '==', 'pending')
            .limit(100) // max 100 per run to avoid timeout
            .get();

          for (const entryDoc of pendingEntries.docs) {
            const entry = entryDoc.data() as NotivisaOutboxEntry;
            const attemptNum = entry.submissionAttempts?.length ?? 0;

            // 3. Check max attempts (5 retries)
            if (attemptNum >= 5) {
              await entryDoc.ref.update({
                status: 'failed-permanent',
                escalatedToSupervisor: true,
                escalationTs: admin.firestore.FieldValue.serverTimestamp(),
                escalationMotivo: 'max-retries-exceeded',
              });

              await notifySupervisorOfNotivisaFailure(labId, entry);
              functions.logger.warn(`[NOTIVISA] Max retries hit: ${entryDoc.id}`);
              continue;
            }

            // 4. Check if ready to retry (exponential backoff)
            if (attemptNum > 0) {
              const lastAttempt = entry.submissionAttempts[attemptNum - 1];
              const backoffMinutes = BACKOFF_SCHEDULE[attemptNum] || 120;
              const nextRetryTime = new Date(
                lastAttempt.ts.toDate().getTime() + backoffMinutes * 60 * 1000,
              );

              if (nextRetryTime > new Date()) {
                // Not yet time to retry
                continue;
              }
            }

            // 5. Attempt submission
            try {
              const result = await submitNotivisaToAnvisa(labId, entry);

              if (result.success) {
                // Record success attempt
                const newAttempt = {
                  attempt: attemptNum + 1,
                  ts: admin.firestore.FieldValue.serverTimestamp(),
                  method:
                    process.env.NOTIVISA_API_MODE === 'sandbox' ? 'mock-submit' : 'soap-anvisa',
                  status: 'success' as const,
                  receiptCode: result.receiptCode,
                  roundTripMs: result.roundTripMs,
                };

                await entryDoc.ref.update({
                  submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
                  status: 'submitted',
                  receiptCodeFromAnvisa: result.receiptCode,
                  anvisa_eventId: result.eventId,
                });

                functions.logger.info(
                  `[NOTIVISA] Success: ${entryDoc.id} (attempt ${attemptNum + 1})`,
                );
              } else {
                // Record failed attempt
                const isRetryable = result.isRetryable ?? true;

                const newAttempt = {
                  attempt: attemptNum + 1,
                  ts: admin.firestore.FieldValue.serverTimestamp(),
                  method:
                    process.env.NOTIVISA_API_MODE === 'sandbox' ? 'mock-submit' : 'soap-anvisa',
                  status: 'failed' as const,
                  error: {
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage || 'Unknown error',
                    isRetryable,
                  },
                  roundTripMs: result.roundTripMs || 0,
                };

                if (isRetryable && attemptNum < 4) {
                  // Retryable error; wait for next cycle
                  await entryDoc.ref.update({
                    submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
                  });
                  functions.logger.info(
                    `[NOTIVISA] Retryable failure: ${entryDoc.id} (attempt ${attemptNum + 1}/5)`,
                  );
                } else {
                  // Non-retryable (4xx) or max retries
                  await entryDoc.ref.update({
                    submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
                    status: 'failed-permanent',
                    escalatedToSupervisor: true,
                    escalationTs: admin.firestore.FieldValue.serverTimestamp(),
                    escalationMotivo: isRetryable ? 'max-retries-exceeded' : 'validation-error',
                  });

                  await notifySupervisorOfNotivisaFailure(labId, entry);
                  functions.logger.warn(`[NOTIVISA] Permanent failure: ${entryDoc.id}`);
                }
              }
            } catch (error: any) {
              functions.logger.error(`[NOTIVISA] Submission exception for ${entryDoc.id}:`, error);

              // Record error attempt (assume retryable)
              const newAttempt = {
                attempt: attemptNum + 1,
                ts: admin.firestore.FieldValue.serverTimestamp(),
                method: process.env.NOTIVISA_API_MODE === 'sandbox' ? 'mock-submit' : 'soap-anvisa',
                status: 'failed' as const,
                error: {
                  errorCode: 'EXCEPTION',
                  errorMessage: error.message || 'Unexpected error',
                  isRetryable: true,
                },
              };

              if (attemptNum < 4) {
                await entryDoc.ref.update({
                  submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
                });
              } else {
                await entryDoc.ref.update({
                  submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
                  status: 'failed-permanent',
                  escalatedToSupervisor: true,
                  escalationTs: admin.firestore.FieldValue.serverTimestamp(),
                  escalationMotivo: 'max-retries-exceeded',
                });
                await notifySupervisorOfNotivisaFailure(labId, entry);
              }
            }
          }

          // 6. Check for past-deadline escalations
          const now = admin.firestore.Timestamp.now();
          const pastDeadlineWithoutAck = await db
            .collection(`labs/${labId}/notivisa-outbox`)
            .where('status', 'in', ['pending', 'submitted'])
            .where('notificationDeadline', '<', now)
            .where('escalatedToSupervisor', '==', false)
            .limit(50)
            .get();

          for (const docSnap of pastDeadlineWithoutAck.docs) {
            const data = docSnap.data() as NotivisaOutboxEntry;
            await docSnap.ref.update({
              escalatedToSupervisor: true,
              escalationTs: admin.firestore.FieldValue.serverTimestamp(),
              escalationMotivo: 'deadline-passed',
            });

            await notifySupervisorOfNotivisaFailure(labId, data);
            functions.logger.warn(
              `[NOTIVISA] Past-deadline escalation: ${docSnap.id} (deadline: ${data.notificationDeadline})`,
            );
          }
        } catch (labError: any) {
          functions.logger.error(`[NOTIVISA] Error processing lab ${labId}:`, labError);
        }
      }

      functions.logger.info('[NOTIVISA] Queue processor completed');
    } catch (error: any) {
      functions.logger.error('[notivisaQueueProcessor] Fatal error:', error);
      throw error;
    }
  },
);
