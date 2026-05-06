/**
 * auditHash.ts — shared utilities for audit signature generation
 *
 * Deterministic SHA-256 hashing for Firestore payload integrity.
 */

import * as crypto from 'crypto';

/**
 * Generate deterministic SHA-256 hash of a payload
 * Used for audit signature generation on server side.
 */
export function generateLogicalSignature(payload: any): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify hash matches payload
 */
export function verifyLogicalSignature(payload: any, expectedHash: string): boolean {
  const computed = generateLogicalSignature(payload);
  return computed === expectedHash;
}
