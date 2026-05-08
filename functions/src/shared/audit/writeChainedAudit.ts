/**
 * shared/audit/writeChainedAudit — resilience wrapper for the HMAC-chained
 * cryptoAudit subsystem (`modules/audit/cryptoAudit.ts:signAuditEntry`).
 *
 * Why a separate helper from `writeAuditLog`:
 *   - `writeAuditLog` writes to a flat `auditLogs/{autoId}` collection and is
 *     loss-tolerant (each entry is independent).
 *   - `signAuditEntry` builds an HMAC chain — every entry's `previousHash`
 *     references the prior write into the same `collectionPath`. We CANNOT
 *     route failure markers into the chain target; doing so either corrupts
 *     the chain (if the marker is signed) or breaks `previousHash` continuity
 *     (if it isn't). Markers must land in a sibling collection.
 *
 * Behaviour:
 *   1. Calls `signAuditEntry` up to 3 times with exponential backoff
 *      (100ms / 400ms / 1500ms) — same cadence as `writeAuditLog`.
 *   2. On final failure, writes a marker doc into a sibling collection
 *      `<parent>/<leaf>-auditFailures/{autoId}` containing the intent +
 *      truncated error string. The chain stays untouched.
 *   3. Emits a structured `console.error` for Cloud Logs.
 *   4. Returns `{ ok: true, id }` or `{ ok: false, error }`. Never throws.
 *
 * Caller contract: `await` the result; helper is non-blocking by intent
 * (audit failure must NOT propagate to the user) but the retry loop must
 * complete before the function returns or the marker may not be flushed.
 */

import * as admin from 'firebase-admin';
import { signAuditEntry } from '../../modules/audit/cryptoAudit';
import { AuditEntry } from '../../modules/audit/types';

export interface ChainedAuditPayload {
  /** Chain target collection path, e.g. `/labs/{labId}/notas-fiscais`. */
  collectionPath: string;
  /** Operator UID (matches `request.auth.uid`). */
  operadorId: string;
  /** Domain operation, e.g. `notaFiscal.criada`. */
  operation: string;
  /** Operation-specific payload (no PII secrets). */
  payload: Record<string, unknown>;
  /** HMAC secret resolved from `defineSecret(...).value()`. */
  secret: string;
}

export type WriteChainedAuditResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [100, 400, 1500];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Compute the sibling failure-marker collection path for a given chain target.
 *
 *   /labs/abc/notas-fiscais            → /labs/abc/notas-fiscais-auditFailures
 *   labs/abc/notas-fiscais             → labs/abc/notas-fiscais-auditFailures
 *   /labs/abc/x/y/audit                → /labs/abc/x/y/audit-auditFailures
 *
 * Single-segment paths (`/foo`) get a top-level sibling `foo-auditFailures`.
 * The sibling lives next to the chain — never inside it — so chain hash
 * continuity is preserved.
 */
export function failureMarkerCollectionPath(chainPath: string): string {
  const trimmed = chainPath.replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = trimmed.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new Error(`invalid chain path: ${chainPath}`);
  }
  const leaf = segments[segments.length - 1];
  segments[segments.length - 1] = `${leaf}-auditFailures`;
  return segments.join('/');
}

export async function writeChainedAudit(
  entry: ChainedAuditPayload,
  firestore?: admin.firestore.Firestore,
): Promise<WriteChainedAuditResult> {
  const db = firestore ?? admin.firestore();

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const signed: AuditEntry = await signAuditEntry(
        entry.collectionPath,
        entry.operadorId,
        entry.operation,
        entry.payload,
        entry.secret,
      );
      // signAuditEntry assigns id after firestore.add(); narrow for caller.
      const id =
        typeof signed.id === 'string' && signed.id.length > 0
          ? signed.id
          : '';
      return { ok: true, id };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BACKOFF_MS[attempt]);
      }
    }
  }

  const errorMsg =
    lastError instanceof Error ? lastError.message : String(lastError);

  // eslint-disable-next-line no-console
  console.error('[writeChainedAudit] FAILED after retries', {
    collectionPath: entry.collectionPath,
    operation: entry.operation,
    operadorId: entry.operadorId,
    error: errorMsg,
    attempts: MAX_ATTEMPTS,
  });

  // Sibling failure marker — never written into the chain target.
  let siblingPath: string;
  try {
    siblingPath = failureMarkerCollectionPath(entry.collectionPath);
  } catch (pathErr) {
    const pathErrMsg =
      pathErr instanceof Error ? pathErr.message : String(pathErr);
    // eslint-disable-next-line no-console
    console.error(
      '[writeChainedAudit] CRITICAL: cannot derive sibling path for marker',
      {
        collectionPath: entry.collectionPath,
        error: pathErrMsg,
      },
    );
    return { ok: false, error: errorMsg };
  }

  try {
    await db.collection(siblingPath).add({
      chainCollectionPath: entry.collectionPath,
      operation: entry.operation,
      operadorId: entry.operadorId,
      intendedPayload: entry.payload,
      error: errorMsg.slice(0, 2000),
      attempts: MAX_ATTEMPTS,
      recordedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (markerErr) {
    const markerMsg =
      markerErr instanceof Error ? markerErr.message : String(markerErr);
    // eslint-disable-next-line no-console
    console.error(
      '[writeChainedAudit] CRITICAL: sibling marker write also failed',
      {
        collectionPath: entry.collectionPath,
        siblingPath,
        operation: entry.operation,
        error: markerMsg,
      },
    );
  }

  return { ok: false, error: errorMsg };
}
