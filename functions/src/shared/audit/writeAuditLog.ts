/**
 * shared/audit/writeAuditLog — resilient audit log writer
 *
 * Replaces the legacy `db.collection('auditLogs').add({...}).catch(() => {})`
 * pattern, which swallowed every failure silently and made audit-trail loss
 * invisible to operators. RDC 978 Art. 128 + DICQ 4.4 require demonstrable
 * traceability of regulatory events; a silent drop is a compliance hole.
 *
 * Behaviour:
 *  1. Attempts the write up to 3 times with exponential backoff
 *     (100ms → 400ms → 1500ms).
 *  2. On final failure, emits a structured `console.error` so Cloud Logs
 *     surfaces the loss, AND writes a fallback document into
 *     `auditLogFailures/{labId|_unknown}/events/{autoId}` containing the
 *     intended payload + truncated error string. The failure itself is
 *     auditable — that is the alert mechanism.
 *  3. Returns `{ ok: true, id }` on success or `{ ok: false, error }` on
 *     final failure. Caller decides whether to fail loud (throw) or
 *     swallow — the helper never throws on its own.
 *
 * Non-blocking by design: callers should `await` to ensure the retry loop
 * completes before the function returns, but a failure here MUST NOT
 * propagate to the user (audit logging is best-effort observability, not
 * a transactional guarantee). The fallback collection captures the loss.
 */

import * as admin from 'firebase-admin';

export interface AuditLogPayload {
  action: string;
  callerUid?: string | null;
  callerEmail?: string | null;
  targetUid?: string | null;
  targetEmail?: string | null;
  targetId?: string | null;
  labId?: string | null;
  payload?: Record<string, unknown> | null;
  // Allow arbitrary extra fields (some callsites add `kind`, `severity`, `detail`, etc).
  [key: string]: unknown;
}

export type WriteAuditLogResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [100, 400, 1500];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Write an audit log entry to `auditLogs/` with retry + fallback.
 *
 * @param entry — payload (timestamp is added automatically if absent)
 * @param firestore — optional Firestore instance (defaults to admin.firestore())
 */
export async function writeAuditLog(
  entry: AuditLogPayload,
  firestore?: admin.firestore.Firestore,
): Promise<WriteAuditLogResult> {
  const db = firestore ?? admin.firestore();

  const payload: Record<string, unknown> = {
    ...entry,
    timestamp:
      entry.timestamp ?? admin.firestore.FieldValue.serverTimestamp(),
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const ref = await db.collection('auditLogs').add(payload);
      return { ok: true, id: ref.id };
    } catch (err) {
      lastError = err;
      // Don't sleep after the final attempt.
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF_MS[attempt]);
      }
    }
  }

  // All retries exhausted. Surface the loss two ways:
  //   1. structured console.error → Cloud Logs / Sentry / monitoring
  //   2. fallback doc in auditLogFailures/{labId}/events/{autoId}
  const errorMsg =
    lastError instanceof Error ? lastError.message : String(lastError);

  // eslint-disable-next-line no-console
  console.error('[writeAuditLog] FAILED after retries', {
    action: entry.action,
    labId: entry.labId ?? null,
    callerUid: entry.callerUid ?? null,
    targetId: entry.targetId ?? entry.targetUid ?? null,
    error: errorMsg,
    attempts: MAX_ATTEMPTS,
  });

  // Fallback write — intentionally without retry. If THIS also fails the
  // console.error above is the last line of defence. We refuse to throw.
  const labId =
    typeof entry.labId === 'string' && entry.labId.length > 0
      ? entry.labId
      : '_unknown';

  try {
    await db
      .collection('auditLogFailures')
      .doc(labId)
      .collection('events')
      .add({
        intendedPayload: payload,
        error: errorMsg.slice(0, 2000),
        attempts: MAX_ATTEMPTS,
        recordedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (fallbackErr) {
    const fallbackMsg =
      fallbackErr instanceof Error
        ? fallbackErr.message
        : String(fallbackErr);
    // eslint-disable-next-line no-console
    console.error(
      '[writeAuditLog] CRITICAL: fallback write also failed',
      {
        action: entry.action,
        labId,
        error: fallbackMsg,
      },
    );
  }

  return { ok: false, error: errorMsg };
}
