/**
 * processQueue.ts — Scheduled NOTIVISA queue processor (5-min cron).
 *
 * Wave 2 Agent 10 — test-mode lifecycle. Reads events from
 * `notivisa-queue/{labId}/events` where `status === 'pending'` and
 * `nextRetry <= now`, dispatches via `dispatchSubmission` (test-mode by
 * default), then either:
 *   - on success: updates the event to `acknowledged` and archives a copy
 *     into `notivisa-outbox/{labId}/archives/{archiveId}` (immutable).
 *   - on retryable failure: increments attempts, sets
 *     `nextRetry = now + 2^n minutes`, status stays `pending`.
 *   - on permanent failure (max retries exceeded or non-retryable):
 *     status `failed-permanent`, escalate flag set.
 *
 * Uses a `collectionGroup('events')` query so we don't have to iterate
 * over labs explicitly. Bounded batch size (50/run) to stay well under
 * the function timeout in test mode.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

import { getNotivisaMode, dispatchSubmission } from './testMode';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

interface QueueEventDoc {
  labId: string;
  draftId: string;
  laudoId: string;
  pacienteCpfMasked: string;
  mode: 'test' | 'sandbox' | 'prod';
  status: 'pending' | 'acknowledged' | 'failed-permanent';
  attempts: number;
  maxAttempts: number;
  nextRetry: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

function backoffMinutes(attempt: number): number {
  // 2^n minutes: 1, 2, 4, 8, 16
  return Math.pow(2, Math.max(0, attempt));
}

export async function runQueueOnce(
  db: admin.firestore.Firestore = admin.firestore(),
  now: Date = new Date(),
): Promise<{
  picked: number;
  acknowledged: number;
  retried: number;
  permanentlyFailed: number;
}> {
  const mode = getNotivisaMode();
  const nowTs = admin.firestore.Timestamp.fromDate(now);

  const snap = await db
    .collectionGroup('events')
    .where('status', '==', 'pending')
    .where('nextRetry', '<=', nowTs)
    .orderBy('nextRetry', 'asc')
    .limit(BATCH_SIZE)
    .get();

  let acknowledged = 0;
  let retried = 0;
  let permanentlyFailed = 0;

  for (const doc of snap.docs) {
    // collectionGroup returns docs across all labs; restrict to NOTIVISA queue.
    if (!doc.ref.path.startsWith('notivisa-queue/')) continue;

    const event = doc.data() as QueueEventDoc;
    const attemptNumber = (event.attempts ?? 0) + 1;

    let outcome;
    try {
      outcome = await dispatchSubmission(mode, {
        labId: event.labId,
        draftId: event.draftId,
        laudoId: event.laudoId,
        attempt: attemptNumber,
      });
    } catch (err) {
      // sandbox/prod unimplemented surfaces here — treat as non-retryable
      // permanent failure so we don't loop on it forever.
      console.error('[NOTIVISA_QUEUE_DISPATCH_ERROR]', {
        eventId: doc.id,
        labId: event.labId,
        mode,
        error: err instanceof Error ? err.message : String(err),
      });
      await doc.ref.update({
        status: 'failed-permanent',
        attempts: attemptNumber,
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: nowTs,
        escalatedToSupervisor: true,
      });
      permanentlyFailed += 1;
      continue;
    }

    if (outcome.ok) {
      const archiveRef = db
        .collection(`notivisa-outbox/${event.labId}/archives`)
        .doc();
      const batch = db.batch();
      batch.update(doc.ref, {
        status: 'acknowledged',
        attempts: attemptNumber,
        lastAttemptAt: nowTs,
        updatedAt: nowTs,
        receiptCode: outcome.ack.receiptCode,
        govEventId: outcome.ack.govEventId,
        roundTripMs: outcome.ack.roundTripMs,
        archiveId: archiveRef.id,
      });
      batch.set(archiveRef, {
        labId: event.labId,
        draftId: event.draftId,
        laudoId: event.laudoId,
        eventId: doc.id,
        mode,
        receiptCode: outcome.ack.receiptCode,
        govEventId: outcome.ack.govEventId,
        govStatus: outcome.ack.govStatus,
        roundTripMs: outcome.ack.roundTripMs,
        respondedAt: outcome.ack.respondedAt,
        isSynthetic: outcome.ack.isSynthetic,
        archivedAt: nowTs,
        // exportedBy left null until exportOutbox.ts produces a CSV.
        exportedBy: null,
      });
      await batch.commit();
      acknowledged += 1;
      continue;
    }

    // failure path
    const failure = outcome.failure;
    const isRetryable = failure.isRetryable && attemptNumber < (event.maxAttempts ?? MAX_ATTEMPTS);
    if (!isRetryable) {
      await doc.ref.update({
        status: 'failed-permanent',
        attempts: attemptNumber,
        lastAttemptAt: nowTs,
        updatedAt: nowTs,
        lastError: failure.errorMessage,
        lastErrorCode: failure.errorCode,
        escalatedToSupervisor: true,
      });
      permanentlyFailed += 1;
      continue;
    }

    const nextRetryDate = new Date(now.getTime() + backoffMinutes(attemptNumber) * 60 * 1000);
    await doc.ref.update({
      attempts: attemptNumber,
      lastAttemptAt: nowTs,
      updatedAt: nowTs,
      lastError: failure.errorMessage,
      lastErrorCode: failure.errorCode,
      nextRetry: admin.firestore.Timestamp.fromDate(nextRetryDate),
    });
    retried += 1;
  }

  console.info('[NOTIVISA_QUEUE_RUN]', {
    mode,
    picked: snap.size,
    acknowledged,
    retried,
    permanentlyFailed,
    ts: now.toISOString(),
  });

  return {
    picked: snap.size,
    acknowledged,
    retried,
    permanentlyFailed,
  };
}

export const processQueue = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    retryCount: 0,
  },
  async () => {
    await runQueueOnce();
  },
);
