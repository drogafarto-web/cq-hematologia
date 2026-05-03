// @ts-ignore
import { describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';
import {
  computeHmac,
  hashData,
  verifyAuditEntry,
} from './cryptoAudit';
import { AuditEntry } from './types';

describe('cryptoAudit', () => {
  const testSecret = crypto.randomBytes(32).toString('hex');

  const mockEntry: AuditEntry = {
    collectionPath: '/test-audit',
    timestamp: { _seconds: 1704067200, _nanoseconds: 0 },
    operadorId: 'user-123',
    operation: 'test.operation',
    payload: { testData: 'value', count: 42 },
    hmac: '',
    hash: '',
    previousHash: null,
  };

  describe('computeHmac', () => {
    it('should compute HMAC-SHA256 deterministically', () => {
      const data = { b: 2, a: 1 };
      const hmac1 = computeHmac(data, testSecret);
      const hmac2 = computeHmac(data, testSecret);

      expect(hmac1).toBe(hmac2);
      expect(hmac1).toMatch(/^[a-f0-9]{64}$/); // 256-bit hex
    });

    it('should differ when secret changes', () => {
      const data = { test: 'data' };
      const hmac1 = computeHmac(data, testSecret);
      const hmac2 = computeHmac(data, 'different-secret');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should differ when data changes', () => {
      const data1 = { value: 1 };
      const data2 = { value: 2 };

      const hmac1 = computeHmac(data1, testSecret);
      const hmac2 = computeHmac(data2, testSecret);

      expect(hmac1).not.toBe(hmac2);
    });

    it('should be independent of key order', () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, a: 1, b: 2 };

      const hmac1 = computeHmac(data1, testSecret);
      const hmac2 = computeHmac(data2, testSecret);

      expect(hmac1).toBe(hmac2);
    });
  });

  describe('hashData', () => {
    it('should compute SHA-256 hash deterministically', () => {
      const data = { test: 'data' };
      const hash1 = hashData(data);
      const hash2 = hashData(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 256-bit hex
    });

    it('should differ when data changes', () => {
      const hash1 = hashData({ value: 1 });
      const hash2 = hashData({ value: 2 });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyAuditEntry', () => {
    it('should pass when HMAC and hash are valid', () => {
      const hmac = computeHmac(mockEntry, testSecret);
      const dataWithHmac = { ...mockEntry, hmac };
      const hash = hashData(dataWithHmac);

      const entry: AuditEntry = {
        ...mockEntry,
        hmac,
        hash,
      };

      const result = verifyAuditEntry(entry, testSecret);
      expect(result.valid).toBe(true);
    });

    it('should fail when HMAC is modified', () => {
      const hmac = computeHmac(mockEntry, testSecret);
      const dataWithHmac = { ...mockEntry, hmac };
      const hash = hashData(dataWithHmac);

      const entry: AuditEntry = {
        ...mockEntry,
        hmac: 'invalid' + hmac.slice(7),
        hash,
      };

      const result = verifyAuditEntry(entry, testSecret);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HMAC mismatch');
    });

    it('should fail when hash is modified', () => {
      const hmac = computeHmac(mockEntry, testSecret);
      const dataWithHmac = { ...mockEntry, hmac };
      const hash = hashData(dataWithHmac);

      const entry: AuditEntry = {
        ...mockEntry,
        hmac,
        hash: 'invalid' + hash.slice(7),
      };

      const result = verifyAuditEntry(entry, testSecret);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Hash mismatch');
    });

    it('should fail when payload is modified after signing', () => {
      const hmac = computeHmac(mockEntry, testSecret);
      const dataWithHmac = { ...mockEntry, hmac };
      const hash = hashData(dataWithHmac);

      const entry: AuditEntry = {
        ...mockEntry,
        payload: { ...mockEntry.payload, tampered: true },
        hmac,
        hash,
      };

      const result = verifyAuditEntry(entry, testSecret);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HMAC mismatch');
    });

    it('should fail when secret is wrong', () => {
      const hmac = computeHmac(mockEntry, testSecret);
      const dataWithHmac = { ...mockEntry, hmac };
      const hash = hashData(dataWithHmac);

      const entry: AuditEntry = {
        ...mockEntry,
        hmac,
        hash,
      };

      const result = verifyAuditEntry(entry, 'wrong-secret');
      expect(result.valid).toBe(false);
    });
  });
});
