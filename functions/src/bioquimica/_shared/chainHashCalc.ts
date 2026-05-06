/**
 * chainHashCalc — Server-side chain hash calculation
 *
 * Deterministic SHA-256 based on canonical payload + previous hash.
 * Used in Firestore rules validation (client hash vs server hash must match).
 *
 * Pattern: SHA-256(prevHash + canonical(payload))
 */

import * as crypto from 'crypto';

/**
 * Canonicalize a payload for deterministic hashing
 * JSON with sorted keys (no whitespace)
 */
export function canonicalizePayload(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort(), 0);
}

/**
 * Calculate SHA-256 synchronously (Node.js crypto)
 * Server-side only
 */
export function sha256Sync(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Calculate chain hash: SHA-256(prevHash + canonical(payload))
 * Deterministic: same input = same output
 *
 * @param prevChainHash Previous hash in sequence (or 'genesis' for first)
 * @param payload Data to hash (will be canonicalized)
 * @returns SHA-256 hex string (64 chars)
 */
export function calculateChainHashSync(prevChainHash: string, payload: any): string {
  const canonical = canonicalizePayload(payload);
  const combined = prevChainHash + canonical;
  return sha256Sync(combined);
}

/**
 * Validate that a chain hash is correctly formatted
 */
export function isValidChainHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}
