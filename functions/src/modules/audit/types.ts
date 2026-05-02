import { Timestamp } from 'firebase-admin/firestore';

export interface AuditEntry {
  id?: string;
  collectionPath: string;
  timestamp: Timestamp | { _seconds: number; _nanoseconds: number };
  operadorId: string;
  operation: string;
  payload: Record<string, any>;
  hmac: string;
  hash: string;
  previousHash: string | null;
  _migratedAt?: Timestamp;
  _legacyHash?: string;
}

export interface ChainValidationResult {
  valid: boolean;
  violations: Array<{
    docId: string;
    reason: 'hmac-mismatch' | 'hash-sequence-broken' | 'missing-hash';
    expected?: string;
    actual?: string;
  }>;
  stats: {
    scanned: number;
    valid: number;
    invalid: number;
    duration: number;
  };
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}
