import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { AuditEntry, VerificationResult } from './types';

const db = admin.firestore();

/**
 * Compute HMAC-SHA256 for deterministic data
 * Keys are sorted for reproducibility
 */
export function computeHmac(data: Record<string, any>, secret: string): string {
  const canonicalJson = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHmac('sha256', secret).update(canonicalJson, 'utf-8').digest('hex');
}

/**
 * Compute SHA-256 hash for deterministic data
 * Keys are sorted for reproducibility
 */
export function hashData(data: Record<string, any>): string {
  const json = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(json, 'utf-8').digest('hex');
}

/**
 * Get the previous hash in a collection (for chain)
 */
export async function getPreviousHashInCollection(
  collectionPath: string,
  secret: string,
  orderBy: 'timestamp' | 'createdAt' = 'timestamp',
): Promise<string | null> {
  try {
    const snapshot = await db.collection(collectionPath).orderBy(orderBy, 'desc').limit(1).get();

    if (snapshot.empty) return null;

    const lastEntry = snapshot.docs[0].data() as AuditEntry;
    return lastEntry.hash || null;
  } catch (error: any) {
    // Collection might not exist yet
    if (error.code === 'FAILED_PRECONDITION') {
      return null;
    }
    throw error;
  }
}

/**
 * Sign an audit entry with HMAC + hash
 */
export async function signAuditEntry(
  collectionPath: string,
  operadorId: string,
  operation: string,
  payload: Record<string, any>,
  secret: string,
): Promise<AuditEntry> {
  // Get previous hash for chain
  const previousHash = await getPreviousHashInCollection(collectionPath, secret, 'timestamp');

  // Create entry data (without hmac/hash yet)
  const entryData = {
    collectionPath,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    operadorId,
    operation,
    payload,
    previousHash,
  };

  // Compute HMAC
  const hmac = computeHmac(entryData as Record<string, any>, secret);

  // Compute hash (with hmac included)
  const dataWithHmac = { ...entryData, hmac };
  const hash = hashData(dataWithHmac as Record<string, any>);

  // Final entry with crypto fields
  const finalEntry = {
    ...entryData,
    hmac,
    hash,
  } as AuditEntry;

  // Write to Firestore
  const docRef = await db.collection(collectionPath).add(finalEntry);

  return { ...finalEntry, id: docRef.id };
}

/**
 * Verify audit entry integrity
 */
export function verifyAuditEntry(entry: AuditEntry, secret: string): VerificationResult {
  // Recompute HMAC (without hmac field)
  const { hmac: originalHmac, hash: originalHash, ...dataForHmac } = entry;

  // Recompute HMAC
  const computedHmac = computeHmac(dataForHmac, secret);
  if (computedHmac !== originalHmac) {
    return {
      valid: false,
      reason: `HMAC mismatch: expected ${originalHmac}, computed ${computedHmac}`,
    };
  }

  // Recompute hash (with hmac included)
  const dataWithHmac = { ...dataForHmac, hmac: originalHmac };
  const computedHash = hashData(dataWithHmac);
  if (computedHash !== originalHash) {
    return {
      valid: false,
      reason: `Hash mismatch: expected ${originalHash}, computed ${computedHash}`,
    };
  }

  return { valid: true };
}

/**
 * Validate chain integrity for a collection
 */
export async function validateChainIntegrity(
  collectionPath: string,
  secret: string,
  options?: { batchSize?: number },
): Promise<any> {
  const startTime = Date.now();
  const violations = [];
  let scanned = 0;
  let valid = 0;

  // Query all entries, sorted by timestamp ascending
  const snapshot = await db.collection(collectionPath).orderBy('timestamp', 'asc').get();

  let previousHash: string | null = null;

  for (const doc of snapshot.docs) {
    scanned++;
    const entry = doc.data() as AuditEntry;

    // Verify HMAC
    const hmacCheck = verifyAuditEntry(entry, secret);
    if (!hmacCheck.valid) {
      violations.push({
        docId: doc.id,
        reason: 'hmac-mismatch',
        expected: entry.hmac,
        message: hmacCheck.reason,
      });
      continue;
    }

    // Verify chain (previousHash matches)
    if (entry.previousHash !== previousHash) {
      violations.push({
        docId: doc.id,
        reason: 'hash-sequence-broken',
        expected: previousHash,
        actual: entry.previousHash,
      });
      continue;
    }

    valid++;
    previousHash = entry.hash;
  }

  return {
    valid: violations.length === 0,
    violations,
    stats: {
      scanned,
      valid,
      invalid: scanned - valid,
      duration: Date.now() - startTime,
    },
  };
}

// ADR 0003 — NC Gate (Wave 3 Integration)
// import { checkNCs } from '../qualidade/naoConformidade';
