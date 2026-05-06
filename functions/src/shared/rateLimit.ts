/**
 * functions/src/shared/rateLimit.ts
 *
 * Per SECURITY_AUDIT.md #18 — Rate limiting for Cloud Functions callables and HTTP endpoints.
 *
 * Two granularities:
 *   - public buckets: keyed by IP (anonymous endpoints) — default 10/min
 *   - authenticated buckets: keyed by uid — default 60/min
 *
 * Storage: Firestore counters under /_system/rate-limits/{bucketKey}
 *   - sliding window via fixed-window approximation (resetAt timestamp)
 *   - atomic increment via FieldValue.increment(1) — not transactional, fail-open
 *
 * Returns:
 *   - allowed: boolean — false if quota exceeded
 *   - remaining: requests left in current window
 *   - retryAfterMs: ms until window resets (only meaningful when !allowed)
 *
 * Caller should:
 *   - return 429 + Retry-After header when !allowed (HTTP)
 *   - throw HttpsError('resource-exhausted', ...) when !allowed (callable)
 *
 * Logged to /labs/{labId}/audit-logs/ (or system collection if no lab) via
 * logRateLimitHit() helper for monitoring.
 */

import * as admin from 'firebase-admin';

export interface RateLimitOptions {
  /** Identifier for the bucket — typically `${endpoint}:${ip|uid}` */
  bucketKey: string;
  /** Max requests allowed per window. */
  maxRequests: number;
  /** Window length in ms. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const RATE_LIMIT_COLLECTION = '_system';
const RATE_LIMIT_DOC = 'rate-limits';

function bucketRef(bucketKey: string) {
  // Sanitize bucketKey: replace / with __ to avoid Firestore path issues
  const safeKey = bucketKey.replace(/\//g, '__').slice(0, 1500);
  return admin
    .firestore()
    .collection(RATE_LIMIT_COLLECTION)
    .doc(RATE_LIMIT_DOC)
    .collection('buckets')
    .doc(safeKey);
}

async function checkAndIncrement(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const ref = bucketRef(opts.bucketKey);
  const now = Date.now();

  // Use a transaction for correctness under concurrent requests
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists
      ? (snap.data() as { count?: number; resetAt?: number })
      : null;

    if (!data || !data.resetAt || data.resetAt < now) {
      // Window expired or first request — start new window
      tx.set(ref, {
        count: 1,
        resetAt: now + opts.windowMs,
        firstHit: now,
      });
      return {
        allowed: true,
        remaining: opts.maxRequests - 1,
        retryAfterMs: 0,
      };
    }

    const count = data.count ?? 0;

    if (count >= opts.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, data.resetAt - now),
      };
    }

    tx.update(ref, {
      count: admin.firestore.FieldValue.increment(1),
    });

    return {
      allowed: true,
      remaining: opts.maxRequests - count - 1,
      retryAfterMs: 0,
    };
  });
}

/**
 * Public endpoint rate limit (per IP, default 10/min).
 * Fail-open if Firestore is unreachable.
 */
export async function enforcePublicRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const result = await checkAndIncrement(opts);
    if (!result.allowed) {
      await logRateLimitHit(opts.bucketKey, 'public', result);
    }
    return result;
  } catch (err) {
    console.warn('[rateLimit] check failed, allowing request:', err);
    return { allowed: true, remaining: opts.maxRequests, retryAfterMs: 0 };
  }
}

/**
 * Authenticated callable rate limit (per uid, default 100/min).
 * Fail-open if Firestore is unreachable.
 */
export async function enforceAuthenticatedRateLimit(
  uid: string,
  endpoint: string,
  maxRequests = 100,
  windowMs = 60 * 1000,
): Promise<RateLimitResult> {
  return enforcePublicRateLimit({
    bucketKey: `auth:${endpoint}:${uid}`,
    maxRequests,
    windowMs,
  });
}

async function logRateLimitHit(
  bucketKey: string,
  scope: 'public' | 'authenticated',
  result: RateLimitResult,
): Promise<void> {
  try {
    await admin
      .firestore()
      .collection(RATE_LIMIT_COLLECTION)
      .doc(RATE_LIMIT_DOC)
      .collection('hits')
      .add({
        bucketKey,
        scope,
        retryAfterMs: result.retryAfterMs,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch {
    // Best-effort
  }
}
