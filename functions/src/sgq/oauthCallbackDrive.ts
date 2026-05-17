/**
 * functions/src/sgq/oauthCallbackDrive.ts
 *
 * Cloud Function HTTP handler for OAuth2 callback from Google Drive
 *
 * GET /api/sgq/oauth-callback?code=..&state=..
 *
 * Flow:
 * 1. User clicks "Authorize Drive" in ImporterWizard step 1
 * 2. Web app calls generateStateToken(labId, userId) → state stored in Firestore
 * 3. User redirected to Google OAuth consent
 * 4. Google redirects here with ?code=...&state=...
 * 5. SECURITY: Validate state token (CSRF guard) — must match stored labId+userId,
 *    not expired, one-time use (deleted on validation)
 * 6. Exchange code for tokens
 * 7. Redirect back to frontend with success/error status
 *
 * Per SECURITY_AUDIT.md #1, #10: state validated, multi-tenant binding enforced.
 * Per SECURITY_AUDIT.md #4 (rate limiting #18): per-IP 10/min limit enforced.
 * Per SECURITY_AUDIT.md #19: security headers set on all responses.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Response } from 'express';
import {
  exchangeCodeForTokens,
  validateStateToken,
} from './_drive/oauthClient';
import { enforcePublicRateLimit } from '../shared/rateLimit';

const FRONTEND_BASE = 'https://hmatologia2.web.app/sgq/importar-drive';

/**
 * Find a state token across all labs.
 * Returns { labId, userId } if found, null otherwise.
 */
async function findStateToken(
  state: string,
): Promise<{ labId: string; userId: string } | null> {
  // Iterate through all labs and check their sgq-oauth-pending collections
  const labsSnap = await admin.firestore().collection('labs').listDocuments();
  
  for (const labRef of labsSnap) {
    const stateDoc = await labRef.collection('sgq-oauth-pending').doc(state).get();
    if (stateDoc.exists) {
      const data = stateDoc.data();
      return { labId: labRef.id, userId: data!.userId };
    }
  }
  
  return null;
}

function setSecurityHeaders(res: Response): void {
  // SECURITY_AUDIT.md #19 — security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function redirectError(res: Response, message: string): void {
  setSecurityHeaders(res);
  const url = new URL(FRONTEND_BASE);
  url.searchParams.append('oauth', 'error');
  url.searchParams.append('message', message);
  res.redirect(url.toString());
}

export const oauthCallbackDrive = functions.https.onRequest(async (req, res) => {
  setSecurityHeaders(res);

  // ─── 1. Rate limit (anti-DOS / brute-force on callback) ────────────────
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';

  try {
    const rl = await enforcePublicRateLimit({
      bucketKey: `oauthCallbackDrive:${clientIp}`,
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000)));
      res.status(429).json({
        error: 'rate_limited',
        retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000),
      });
      return;
    }
  } catch (err) {
    // Fail-open on rate-limit errors so genuine users aren't locked out
    console.warn('[oauthCallbackDrive] rate-limit error', err);
  }

  try {
    const { code, state } = req.query as Record<string, string>;

    if (!code || !state) {
      res.status(400).json({
        error: 'Missing required parameters: code, state',
      });
      return;
    }

    // Length sanity (prevents abuse via huge query strings)
    if (code.length > 2048 || state.length > 256) {
      res.status(400).json({ error: 'Parameter length out of bounds' });
      return;
    }

    // ─── 2. Look up state token to get labId + userId ─────────────────────
    const stateTokenDoc = await findStateToken(state);
    if (!stateTokenDoc) {
      redirectError(res, 'invalid_state');
      return;
    }
    const { labId, userId } = stateTokenDoc;

    // ─── 3. Validate CSRF state token ─────────────────────────────────────
    await validateStateToken(state, labId, userId);

    // ─── 4. Exchange code for tokens ──────────────────────────────────────
    const { expiresIn } = await exchangeCodeForTokens(code, labId, userId);

    // ─── 5. Audit log: successful authorization ───────────────────────────
    await admin
      .firestore()
      .collection('labs')
      .doc(labId)
      .collection('sgq-oauth-logs')
      .add({
        userId,
        event: 'oauth-authorized',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        expiresIn,
        ipAddress: clientIp,
      });

    // ─── 6. Redirect back to frontend ─────────────────────────────────────
    const redirectUrl = new URL(FRONTEND_BASE);
    redirectUrl.searchParams.append('oauth', 'success');
    redirectUrl.searchParams.append('labId', labId);
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[oauthCallbackDrive] error:', error);

    const userMessage =
      error instanceof Error && error.message.includes('state')
        ? 'invalid_state'
        : 'authorization_failed';

    redirectError(res, userMessage);
  }
});
