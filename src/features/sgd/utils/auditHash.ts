import crypto from 'crypto';

/**
 * Generate SHA-256 hash of payload for audit signature.
 * Deterministic: same payload = same hash.
 * Used for immutable audit trail (RN-SGQ-06).
 */
export function generateAuditHash(payload: Record<string, unknown>): string {
  // Serialize deterministically (sorted keys, no cycles)
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

/**
 * Verify audit hash against current payload.
 * Returns true if hash matches, false if tampered.
 */
export function verifyAuditHash(payload: Record<string, unknown>, expectedHash: string): boolean {
  const computed = generateAuditHash(payload);
  return computed === expectedHash;
}
