/**
 * shared/signature — chain hash + LogicalSignature helpers
 *
 * Generates HMAC-SHA256 chain hashes for tamper-evident audit trails.
 * Format: HMAC(secret, payload) → 64 hex chars.
 *
 * Secret comes from `CHAIN_HASH_SECRET` env var (defined in functions config);
 * defaults to a deterministic placeholder for local emulator runs.
 */

import * as crypto from 'crypto';

const SECRET_ENV = 'CHAIN_HASH_SECRET';
const DEFAULT_SECRET = 'hcquality-emulator-default';

function getSecret(): string {
  return process.env[SECRET_ENV] || DEFAULT_SECRET;
}

/**
 * Generate deterministic chain hash from a payload.
 * Accepts a string (already serialized) or any JSON-serializable object.
 */
export function generateChainHash(payload: string | Record<string, unknown>): string {
  const data = typeof payload === 'string' ? payload : canonicalize(payload);
  return crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
}

/**
 * Canonical JSON: sorted keys, deterministic for hashing.
 */
export function canonicalize(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

/**
 * Verify a chain hash against an expected payload.
 */
export function verifyChainHash(
  payload: string | Record<string, unknown>,
  expected: string,
): boolean {
  const computed = generateChainHash(payload);
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expected, 'hex'));
}
