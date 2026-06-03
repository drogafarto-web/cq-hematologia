/**
 * Audit Chain Hash Utility
 *
 * Replicates ADR 0001 (audit chain) pattern for reclamacoes module.
 * Creates sequential, tamper-evident chain of hashes per lab.
 *
 * Pattern:
 * hash(n) = SHA256(hash(n-1) + entity_id + operation + timestamp)
 *
 * Verification: re-hash sequence and compare final hash.
 * Tampering breaks chain: any hash change invalidates all subsequent hashes.
 */

import { createHash } from 'crypto';

/**
 * Compute SHA256 hash of input (hex string)
 *
 * @param data string to hash
 * @returns lowercase hex string, 64 chars
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generate next chain hash in sequence
 *
 * @param previousHash last hash in chain (64-char hex), or empty string for chain start
 * @param entityId document ID being hashed
 * @param operation 'create'|'update'|'delete'|'transition'
 * @param timestamp ISO string (e.g., '2026-05-06T14:30:00Z')
 * @param operatorId userId performing operation
 * @returns 64-char hex hash
 */
export function computeChainHash(
  previousHash: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete' | 'transition',
  timestamp: string,
  operatorId: string,
): string {
  const input = `${previousHash}|${entityId}|${operation}|${timestamp}|${operatorId}`;
  return sha256(input);
}

/**
 * Verify chain integrity — re-hash sequence and compare final
 *
 * @param entries array of chain entries in order
 * @returns { valid: boolean, invalidAt?: number (which entry broke chain) }
 */
export function verifyChainIntegrity(
  entries: Array<{
    previousHash: string;
    entityId: string;
    operation: string;
    timestamp: string;
    operatorId: string;
    actualHash: string;
  }>,
): { valid: boolean; invalidAt?: number } {
  if (entries.length === 0) {
    return { valid: true };
  }

  let expectedPreviousHash = '';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // First entry: previousHash should be empty or match chain start
    if (i === 0) {
      if (entry.previousHash !== '' && entry.previousHash !== expectedPreviousHash) {
        // If chain started before this segment, this is expected
        expectedPreviousHash = entry.previousHash;
      }
    } else {
      // Subsequent entries: previousHash must match what we computed
      if (entry.previousHash !== expectedPreviousHash) {
        return { valid: false, invalidAt: i };
      }
    }

    // Compute what this entry's hash should be
    const computed = computeChainHash(
      entry.previousHash,
      entry.entityId,
      entry.operation as any,
      entry.timestamp,
      entry.operatorId,
    );

    // Check if actual matches computed
    if (entry.actualHash !== computed) {
      return { valid: false, invalidAt: i };
    }

    // Update expectedPreviousHash for next iteration
    expectedPreviousHash = entry.actualHash;
  }

  return { valid: true };
}

/**
 * Generate logical signature for a Firestore document
 * Includes: hash(doc_state), operatorId, timestamp
 *
 * @param docState object being signed (before-after combined for updates)
 * @param operatorId userId
 * @param timestamp ISO string
 * @returns { hash, operatorId, ts }
 */
export function generateLogicalSignature(
  docState: string, // JSON stringified document or diff
  operatorId: string,
  timestamp: string,
): {
  hash: string;
  operatorId: string;
  ts: string;
} {
  // Hash document state + operator + timestamp
  const combinedInput = `${docState}|${operatorId}|${timestamp}`;
  const hash = sha256(combinedInput);

  return {
    hash,
    operatorId,
    ts: timestamp,
  };
}

/**
 * Verify logical signature
 * Rehashes document and checks if hash matches
 */
export function verifyLogicalSignature(
  docState: string,
  operatorId: string,
  timestamp: string,
  claimedHash: string,
): boolean {
  const sig = generateLogicalSignature(docState, operatorId, timestamp);
  return sig.hash === claimedHash;
}

/**
 * Fingerprint a document state for chain tracking
 * Serializes object to deterministic JSON string (sorted keys)
 */
export function fingerprintDocument(doc: Record<string, any>): string {
  try {
    // Recursively sort keys for deterministic output
    const sortKeys = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sortKeys);
      }
      if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj)
          .sort()
          .reduce((result, key) => {
            result[key] = sortKeys(obj[key]);
            return result;
          }, {} as any);
      }
      return obj;
    };

    const sorted = sortKeys(doc);
    return JSON.stringify(sorted);
  } catch (err) {
    // Fallback if serialization fails
    return String(doc);
  }
}

/**
 * Compute diff between two documents for audit log
 * Returns object with only changed fields
 */
export function computeDocDiff(
  before: Record<string, any>,
  after: Record<string, any>,
): Record<string, { before: any; after: any }> {
  const diff: Record<string, { before: any; after: any }> = {};

  // Check all keys in 'after'
  for (const key in after) {
    const beforeVal = before?.[key];
    const afterVal = after[key];

    // Deep equality check
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = { before: beforeVal, after: afterVal };
    }
  }

  // Check if any keys were deleted (in 'before' but not in 'after')
  for (const key in before) {
    if (!(key in after)) {
      diff[key] = { before: before[key], after: undefined };
    }
  }

  return diff;
}
