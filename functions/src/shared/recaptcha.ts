/**
 * shared/recaptcha — Google reCAPTCHA v3 verification helper
 *
 * Validates a client-side token against the reCAPTCHA siteverify endpoint.
 * Returns true when the token is valid AND the score >= threshold (default 0.5).
 *
 * Secret comes from `RECAPTCHA_SECRET` env var. In emulator mode (no secret set)
 * this returns true to allow local dev to proceed.
 */

const SECRET_ENV = 'RECAPTCHA_SECRET';
const SCORE_THRESHOLD = 0.5;

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verify a reCAPTCHA v3 token. Returns true when valid + score >= threshold.
 * Permissive in emulator (no secret configured).
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
): Promise<boolean> {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    // Emulator / local dev — skip verification
    console.warn('[recaptcha] RECAPTCHA_SECRET not set — skipping verification');
    return true;
  }
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json()) as SiteVerifyResponse;

    if (!data.success) return false;
    if (typeof data.score === 'number' && data.score < SCORE_THRESHOLD) return false;
    if (expectedAction && data.action && data.action !== expectedAction) return false;

    return true;
  } catch (err) {
    console.error('[recaptcha] verification failed:', err);
    return false;
  }
}
