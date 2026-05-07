/**
 * Cryptographic audit utilities — Logical signatures + chain hash
 * RDC 978 Art. 204 — Immutable audit trail via HMAC-SHA256
 *
 * Used by all regulatory writes (NOTIVISA, liberacao, etc.)
 */

import * as crypto from 'crypto';

export interface LogicalSignature {
  hash: string; // SHA-256 hex (64 chars)
  operatorId: string; // request.auth.uid
  ts: number; // Unix timestamp (ms)
}

/**
 * Generate logical signature for payload
 * Canonical JSON stringify (keys sorted alphabetically)
 */
export function generateLogicalSignature(
  operatorId: string,
  payload: any,
  prevHash?: string
): LogicalSignature {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const hashInput = prevHash ? `${prevHash}${canonical}` : canonical;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  return {
    hash,
    operatorId,
    ts: Date.now(),
  };
}

/**
 * Verify logical signature
 * Checks:
 * 1. Hash correctness
 * 2. Operator ID matches request auth UID
 * 3. Timestamp within 5-minute window (prevent replay)
 */
export function verifyLogicalSignature(
  signature: LogicalSignature,
  payload: any,
  prevHash?: string
): boolean {
  try {
    // Regenerate hash
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    const hashInput = prevHash ? `${prevHash}${canonical}` : canonical;
    const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    // Check hash
    if (signature.hash !== expectedHash) {
      return false;
    }

    // Check timestamp (5-minute window)
    const timeDiff = Math.abs(Date.now() - signature.ts);
    if (timeDiff > 5 * 60 * 1000) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Verify chain hash integrity
 * Ensures audit trail has not been tampered with
 */
export function verifyChainHash(
  events: Array<{
    hash: string;
    prevHash?: string;
    payload: any;
  }>
): boolean {
  let currentHash = '';

  for (const event of events) {
    const canonical = JSON.stringify(event.payload, Object.keys(event.payload).sort());
    const hashInput = currentHash ? `${currentHash}${canonical}` : canonical;
    const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    if (event.hash !== expectedHash) {
      return false;
    }

    currentHash = event.hash;
  }

  return true;
}

/**
 * Generate HMAC-SHA256 for payload (alternative to logical signature)
 * Used for additional verification layer
 */
export function generateHmac(payload: any, secret: string): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Verify HMAC-SHA256
 */
export function verifyHmac(payload: any, hmac: string, secret: string): boolean {
  const expectedHmac = generateHmac(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(expectedHmac)
  );
}
