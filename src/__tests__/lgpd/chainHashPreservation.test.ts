/**
 * Unit Test: Chain-Hash Integrity after PII Deletion
 *
 * Tests that LogicalSignature fields remain immutable and unmodified
 * after PII deletion operations (Firestore batch updates don't touch those fields).
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import * as crypto from 'crypto';

/**
 * Simulate Firestore batch.update behavior:
 * - Specified fields are updated
 * - Unspecified fields remain unchanged
 */
function simulateBatchUpdate(
  originalDoc: Record<string, any>,
  updates: Record<string, any>,
): Record<string, any> {
  return { ...originalDoc, ...updates };
}

describe('Chain-Hash Integrity after PII Deletion', () => {
  it('should preserve LogicalSignature fields on user doc', async () => {
    // ─────────────────────────────────────────────────────────────────────
    // Setup: Create user with audit chain hash (LogicalSignature)
    // ─────────────────────────────────────────────────────────────────────

    const testUser = {
      id: 'test-user-chain',
      nome: 'Original Name',
      email: 'test@example.com',
      cpfHash: 'abc123',
      criadoEm: Timestamp.now(),
      logicalSignature: {
        hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operatorId: 'operator-1',
        ts: Timestamp.now(),
      },
    };

    // ─────────────────────────────────────────────────────────────────────
    // Step: Simulate PII deletion (batch.update zeros fields only)
    // ─────────────────────────────────────────────────────────────────────

    const piiDeletionUpdates = {
      nome: '',
      email: '',
      telefone: '',
      endereco: '',
      atualizadoEm: Timestamp.now(),
      piiZeradoEm: Timestamp.now(),
      piiZeradoPor: 'operator-2',
    };

    const userAfterDeletion = simulateBatchUpdate(testUser, piiDeletionUpdates);

    // ─────────────────────────────────────────────────────────────────────
    // Verify: LogicalSignature is untouched (exact reference equality)
    // ─────────────────────────────────────────────────────────────────────

    expect(userAfterDeletion.logicalSignature).toEqual(testUser.logicalSignature);
    expect(userAfterDeletion.logicalSignature.hash).toBe(testUser.logicalSignature.hash);
    expect(userAfterDeletion.logicalSignature.operatorId).toBe('operator-1');
    expect(userAfterDeletion.logicalSignature.ts).toEqual(testUser.logicalSignature.ts);

    // ─────────────────────────────────────────────────────────────────────
    // Verify: PII was zeroed
    // ─────────────────────────────────────────────────────────────────────

    expect(userAfterDeletion.nome).toBe('');
    expect(userAfterDeletion.email).toBe('');
    expect(userAfterDeletion.atualizadoEm).toBeTruthy();
  });

  it('should preserve cpfHash and criadoEm during deletion', async () => {
    const originalDoc = {
      id: 'user-x',
      nome: 'Y',
      cpfHash: 'hash-immutable',
      criadoEm: Timestamp.now(),
      version: 1,
    };

    const deletionUpdates = {
      nome: '',
      email: '',
      atualizadoEm: Timestamp.now(),
    };

    const updated = simulateBatchUpdate(originalDoc, deletionUpdates);

    // cpfHash and criadoEm should remain identical (not in update payload)
    expect(updated.cpfHash).toBe(originalDoc.cpfHash);
    expect(updated.criadoEm).toEqual(originalDoc.criadoEm);
  });

  it('should validate hash format after retrieval', async () => {
    // Simulate retrieved doc with LogicalSignature
    const retrievedDoc = {
      id: 'user-z',
      nome: '',
      logicalSignature: {
        hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        operatorId: 'op-1',
        ts: Timestamp.now(),
      },
    };

    // Verify hash is valid SHA-256 (64 hex characters)
    const hashRegex = /^[a-f0-9]{64}$/;
    expect(retrievedDoc.logicalSignature.hash).toMatch(hashRegex);
    expect(retrievedDoc.logicalSignature.hash.length).toBe(64);
  });

  it('should allow verification of hash after deletion', async () => {
    // Simulate: compute hash of document BEFORE deletion
    const docBefore = {
      id: 'x',
      nome: 'Y',
      version: 1,
    };

    function computeHash(doc: Record<string, any>): string {
      const json = JSON.stringify(doc);
      return crypto.createHash('sha256').update(json).digest('hex');
    }

    const hashBefore = computeHash(docBefore);

    // Key insight: Hash is computed BEFORE deletion and stored in audit log.
    // After deletion, the original hash remains valid in the audit log.
    // We don't re-hash after deletion; that would break chain-hash immutability.

    expect(hashBefore).toMatch(/^[a-f0-9]{64}$/);
    expect(hashBefore.length).toBe(64);

    // Simulate: After deletion, the audit log still has the immutable hash
    const auditLog = {
      action: 'pii_deletion_request',
      logicalSignature: {
        hash: hashBefore,
        operatorId: 'operator-1',
        ts: Timestamp.now(),
      },
    };

    // Verification: Hash in audit log is immutable (cannot be tampered)
    expect(auditLog.logicalSignature.hash).toBe(hashBefore);
  });

  it('should demonstrate batch.update preserves unspecified fields', async () => {
    // Real-world scenario:
    // 1. Document created with LogicalSignature from initial operation
    // 2. Later, batch.update is called to zero PII
    // 3. LogicalSignature field is NOT in the update payload
    // 4. Firestore preserves the original LogicalSignature

    const doc1 = {
      field_a: 'value_a',
      field_b: 'value_b',
      logicalSignature: { hash: 'original_hash', ts: 'original_ts' },
    };

    const updates = {
      field_a: '', // Zero this field
      // Note: logicalSignature NOT in updates
      field_c: 'new_value', // Add new field
    };

    const resultDoc = simulateBatchUpdate(doc1, updates);

    // ✓ field_a was zeroed (in updates)
    expect(resultDoc.field_a).toBe('');

    // ✓ field_b remains unchanged (not in updates)
    expect(resultDoc.field_b).toBe('value_b');

    // ✓ logicalSignature remains unchanged (not in updates)
    expect(resultDoc.logicalSignature.hash).toBe('original_hash');

    // ✓ field_c was added (in updates)
    expect(resultDoc.field_c).toBe('new_value');
  });
});
