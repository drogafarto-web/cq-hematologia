/**
 * notivisaStatusCheck — Cron job (5-min polling)
 * Phase 8 — Polls government API for responses to submitted notifications
 *
 * Updates queue status, retries failures with exponential backoff,
 * alerts operator on acknowledgment/rejection.
 *
 * Schedule: every 5 minutes (0 */5 * * * *)
 * Timeout: 120s
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import axios from 'axios';

interface NotivisaQueueEvent {
  id: string;
  labId: string;
  draftId: string;
  status: 'pending' | 'sent' | 'failed' | 'acknowledged' | 'rejected';
  attempts: number;
  maxAttempts: number;
  nextRetry?: number;
  lastAttempt?: number;
  response?: {
    code: string;
    message: string;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface NotivisaConfig {
  enabled: boolean;
  maxRetries: number;
  retryIntervalMs: number;
  batchSize: number;
  govApiUrl?: string;
  govApiKey?: string;
}

const RETRY_BACKOFF_MS = [
  60 * 1000, // 1 min
  5 * 60 * 1000, // 5 min
  30 * 60 * 1000, // 30 min
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
];

const MAX_BATCH_SIZE = 10;
const POLL_TIMEOUT_MS = 10000; // 10 seconds per request

export const notivisaStatusCheck = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'southamerica-east1',
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();

    let totalProcessed = 0;
    let totalAcknowledged = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    try {
      // ========== 1. Fetch all enabled labs ==========
      const labsSnap = await db
        .collectionGroup('notivisa-config')
        .where('enabled', '==', true)
        .get();

      if (labsSnap.empty) {
        console.log('[NOTIVISA] No labs with NOTIVISA enabled');
        return;
      }

      // ========== 2. Process each lab ==========
      for (const configSnap of labsSnap.docs) {
        const configPath = configSnap.ref.path;
        const labId = configPath.split('/')[1]; // Extract labId from path
        const config = configSnap.data() as NotivisaConfig;

        try {
          // Fetch pending events
          const eventsSnap = await db
            .collection('notivisa-queue')
            .doc(labId)
            .collection('events')
            .where('status', 'in', ['pending', 'sent'])
            .where('nextRetry', '<=', now)
            .orderBy('nextRetry', 'asc')
            .limit(config.batchSize || MAX_BATCH_SIZE)
            .get();

          if (eventsSnap.empty) {
            continue;
          }

          // ========== 3. Poll government API per event ==========
          for (const eventSnap of eventsSnap.docs) {
            const event = eventSnap.data() as NotivisaQueueEvent;
            totalProcessed++;

            try {
              // Call government API (v1.4: sandbox only)
              const govResponse = await pollGovernmentAPI(
                event,
                config,
                POLL_TIMEOUT_MS
              );

              if (!govResponse) {
                // Network error: keep as sent, schedule retry
                await scheduleRetry(db, labId, event, now, RETRY_BACKOFF_MS);
                continue;
              }

              // ========== 4. Handle government responses ==========
              if (govResponse.status === 'acknowledged') {
                await db
                  .collection('notivisa-queue')
                  .doc(labId)
                  .collection('events')
                  .doc(eventSnap.id)
                  .update({
                    status: 'acknowledged',
                    response: govResponse,
                    updatedAt: now,
                  });

                await logAuditEvent(db, labId, event.draftId, 'STATUS_POLLED', {
                  eventId: eventSnap.id,
                  previousStatus: event.status,
                  newStatus: 'acknowledged',
                  govResponse,
                  attempts: event.attempts + 1,
                });

                totalAcknowledged++;
              } else if (govResponse.status === 'rejected') {
                await db
                  .collection('notivisa-queue')
                  .doc(labId)
                  .collection('events')
                  .doc(eventSnap.id)
                  .update({
                    status: 'rejected',
                    response: govResponse,
                    updatedAt: now,
                  });

                await logAuditEvent(db, labId, event.draftId, 'STATUS_POLLED', {
                  eventId: eventSnap.id,
                  previousStatus: event.status,
                  newStatus: 'rejected',
                  govResponse,
                  attempts: event.attempts + 1,
                });

                totalFailed++;
              } else {
                // Status unknown: keep sent, retry
                await scheduleRetry(db, labId, event, now, RETRY_BACKOFF_MS);
              }
            } catch (error: any) {
              errors.push(`Event ${eventSnap.id}: ${error.message}`);

              // Retry logic on error
              const newAttempts = event.attempts + 1;
              if (newAttempts >= event.maxAttempts) {
                // Mark as failed
                await db
                  .collection('notivisa-queue')
                  .doc(labId)
                  .collection('events')
                  .doc(eventSnap.id)
                  .update({
                    status: 'failed',
                    attempts: newAttempts,
                    updatedAt: now,
                  });

                await logAuditEvent(db, labId, event.draftId, 'STATUS_POLLED', {
                  eventId: eventSnap.id,
                  previousStatus: event.status,
                  newStatus: 'failed',
                  error: error.message,
                  attempts: newAttempts,
                });

                totalFailed++;
              } else {
                // Schedule next retry
                await scheduleRetry(db, labId, event, now, RETRY_BACKOFF_MS, newAttempts);
              }
            }
          }

          // Update lab config lastPolledAt
          await db
            .collection('labs')
            .doc(labId)
            .collection('notivisa-config')
            .doc('config')
            .update({
              lastPolledAt: now,
            });
        } catch (labError: any) {
          errors.push(`Lab ${labId}: ${labError.message}`);
        }
      }

      // ========== 5. Log summary ==========
      const summary = {
        timestamp: new Date().toISOString(),
        processed: totalProcessed,
        acknowledged: totalAcknowledged,
        failed: totalFailed,
        errorCount: errors.length,
      };

      console.log('[NOTIVISA] Status check summary:', JSON.stringify(summary, null, 2));
      if (errors.length > 0) {
        console.log('[NOTIVISA] Errors encountered:', errors);
      }
    } catch (error: any) {
      console.error('[notivisaStatusCheck] Fatal error:', error);
      throw error;
    }
  }
);

/**
 * Poll government API for event status (v1.4: sandbox only)
 * Returns null on network error, or {status, code, message, timestamp}
 */
async function pollGovernmentAPI(
  event: NotivisaQueueEvent,
  config: NotivisaConfig,
  timeoutMs: number
): Promise<{ status: string; code: string; message: string; timestamp: number } | null> {
  try {
    // v1.4: sandbox endpoint (to be replaced with production in v1.5)
    const endpoint = config.govApiUrl || 'https://sandbox.notivisa.gov.br/api/v1/status';
    const apiKey = config.govApiKey || process.env.NOTIVISA_SANDBOX_API_KEY || '';

    if (!apiKey) {
      console.warn('[NOTIVISA] No API key configured for lab');
      return null;
    }

    const response = await axios.post(
      endpoint,
      {
        event_id: event.id,
        status: event.status,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
      }
    );

    return {
      status: response.data.status || 'pending',
      code: response.data.code || 'UNKNOWN',
      message: response.data.message || '',
      timestamp: Date.now(),
    };
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      // Network error: return null to retry
      return null;
    }

    if (error.response?.status >= 500) {
      // Server error: return null to retry
      return null;
    }

    throw error;
  }
}

/**
 * Schedule retry with exponential backoff
 */
async function scheduleRetry(
  db: admin.firestore.Firestore,
  labId: string,
  event: NotivisaQueueEvent,
  now: number,
  backoffMs: number[],
  newAttempts?: number
): Promise<void> {
  const attempts = newAttempts ?? event.attempts + 1;

  if (attempts >= event.maxAttempts) {
    // Mark as failed
    await db
      .collection('notivisa-queue')
      .doc(labId)
      .collection('events')
      .doc(event.id)
      .update({
        status: 'failed',
        attempts,
        updatedAt: now,
      });
    return;
  }

  // Calculate next retry
  const backoffIndex = Math.min(attempts - 1, backoffMs.length - 1);
  const nextRetry = now + backoffMs[backoffIndex];

  await db
    .collection('notivisa-queue')
    .doc(labId)
    .collection('events')
    .doc(event.id)
    .update({
      status: 'sent',
      attempts,
      nextRetry,
      updatedAt: now,
    });
}

/**
 * Log audit event for status change
 */
async function logAuditEvent(
  db: admin.firestore.Firestore,
  labId: string,
  draftId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await db
      .collection('notivisa-drafts')
      .doc(labId)
      .collection('drafts')
      .doc(draftId)
      .collection('auditLog')
      .add({
        action,
        operatorId: 'system',
        ts: Date.now(),
        details,
      });
  } catch (error: any) {
    console.error('[NOTIVISA] Failed to log audit event:', error);
    // Non-blocking: don't fail cron on audit log error
  }
}
