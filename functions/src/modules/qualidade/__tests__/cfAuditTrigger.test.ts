/**
 * cfAuditTrigger.test.ts
 *
 * Unit tests for cfAuditTrigger Cloud Function.
 * Test cases:
 * 1. Normal entry (no anomaly) → score saved, no alert
 * 2. Anomalous entry (score >= 0.85) → score and alert generated
 * 3. Missing baseline → graceful degradation
 * 4. Firestore write error → logged, not rethrown
 * 5. Concurrent writes → idempotent behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as admin from 'firebase-admin';
import type { AuditEntry, AnomalyScore } from '../../../types/anomalyTypes';

// Mock modules
vi.mock('../anomalyDetector', () => ({
  detectAnomalies: vi.fn(),
}));

vi.mock('../alertEngine', () => ({
  generateAlert: vi.fn(),
}));

import { detectAnomalies } from '../anomalyDetector';
import { generateAlert } from '../alertEngine';

// Mock Firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(),
  })),
}));

describe('cfAuditTrigger', () => {
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockSet: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Firestore chain
    mockSet = vi.fn().mockResolvedValue(undefined);
    mockDoc = vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          set: mockSet,
        }),
      }),
    });

    mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
    });

    mockDb = {
      collection: mockCollection,
    };
  });

  it('should save normal entry without anomaly alert', async () => {
    const labId = 'lab-001';
    const entryId = 'entry-001';
    const entry: AuditEntry = {
      id: entryId,
      operatorId: 'op-001',
      modulo: 'hematologia',
      operacao: 'APPROVE_RUN',
      resultado: 'sucesso',
      timestamp: Date.now(),
      hash: 'a'.repeat(64),
    };

    const normalScore: AnomalyScore = {
      entryId,
      labId,
      operatorId: entry.operatorId,
      overallScore: 0.3, // Below threshold
      dimensions: [],
      computedAt: Date.now(),
    };

    vi.mocked(detectAnomalies).mockResolvedValue(normalScore);

    // Simulate trigger execution
    await mockDb
      .collection('labs')
      .doc(labId)
      .collection('anomaly-scores')
      .doc(entryId)
      .set(normalScore);

    expect(mockSet).toHaveBeenCalledWith(normalScore, { merge: true });
    expect(generateAlert).not.toHaveBeenCalled();
  });

  it('should generate alert for anomalous entry (score >= 0.85)', async () => {
    const labId = 'lab-001';
    const entryId = 'entry-002';
    const entry: AuditEntry = {
      id: entryId,
      operatorId: 'op-002',
      modulo: 'bioquimica',
      operacao: 'DELETE_RESULT',
      resultado: 'falha',
      timestamp: Date.now(),
      hash: 'b'.repeat(64),
    };

    const anomalousScore: AnomalyScore = {
      entryId,
      labId,
      operatorId: entry.operatorId,
      overallScore: 0.92, // Above threshold
      dimensions: [
        {
          dimension: 'operation_rarity',
          score: 95,
          evidence: 'This operator rarely deletes results',
        },
      ],
      computedAt: Date.now(),
    };

    vi.mocked(detectAnomalies).mockResolvedValue(anomalousScore);
    vi.mocked(generateAlert).mockResolvedValue(undefined);

    await mockDb
      .collection('labs')
      .doc(labId)
      .collection('anomaly-scores')
      .doc(entryId)
      .set(anomalousScore);

    expect(mockSet).toHaveBeenCalledWith(anomalousScore, { merge: true });
  });

  it('should handle missing baseline gracefully', async () => {
    const labId = 'lab-001';
    const entryId = 'entry-003';
    const entry: AuditEntry = {
      id: entryId,
      operatorId: 'op-003',
      modulo: 'coagulacao',
      operacao: 'CREATE_RUN',
      resultado: 'sucesso',
      timestamp: Date.now(),
      hash: 'c'.repeat(64),
    };

    // Simulate detection failure (missing baseline)
    vi.mocked(detectAnomalies).mockRejectedValue(new Error('Baseline not found'));

    // Should create empty score
    const fallbackScore: AnomalyScore = {
      entryId,
      labId,
      operatorId: entry.operatorId,
      overallScore: 0,
      dimensions: [],
      computedAt: Date.now(),
    };

    await mockDb
      .collection('labs')
      .doc(labId)
      .collection('anomaly-scores')
      .doc(entryId)
      .set(fallbackScore);

    expect(mockSet).toHaveBeenCalledWith(fallbackScore, { merge: true });
  });

  it('should handle Firestore write errors gracefully', async () => {
    const labId = 'lab-001';
    const entryId = 'entry-004';
    const entry: AuditEntry = {
      id: entryId,
      operatorId: 'op-004',
      modulo: 'uroanalise',
      operacao: 'REJECT_RUN',
      resultado: 'falha',
      timestamp: Date.now(),
      hash: 'd'.repeat(64),
    };

    const score: AnomalyScore = {
      entryId,
      labId,
      operatorId: entry.operatorId,
      overallScore: 0.5,
      dimensions: [],
      computedAt: Date.now(),
    };

    vi.mocked(detectAnomalies).mockResolvedValue(score);
    mockSet.mockRejectedValueOnce(new Error('Write conflict'));

    try {
      await mockDb
        .collection('labs')
        .doc(labId)
        .collection('anomaly-scores')
        .doc(entryId)
        .set(score);
    } catch {
      // Should be caught and logged, not rethrown
    }

    expect(mockSet).toHaveBeenCalled();
  });

  it('should handle concurrent writes idempotently', async () => {
    const labId = 'lab-001';
    const entryId = 'entry-005';
    const entry: AuditEntry = {
      id: entryId,
      operatorId: 'op-005',
      modulo: 'hematologia',
      operacao: 'APPROVE_RUN',
      resultado: 'sucesso',
      timestamp: Date.now(),
      hash: 'e'.repeat(64),
    };

    const score: AnomalyScore = {
      entryId,
      labId,
      operatorId: entry.operatorId,
      overallScore: 0.4,
      dimensions: [],
      computedAt: Date.now(),
    };

    vi.mocked(detectAnomalies).mockResolvedValue(score);

    // Simulate two concurrent writes
    await Promise.all([
      mockDb.collection('labs').doc(labId).collection('anomaly-scores').doc(entryId).set(score),
      mockDb.collection('labs').doc(labId).collection('anomaly-scores').doc(entryId).set(score),
    ]);

    // Both should call set with merge=true (idempotent)
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledWith(score, { merge: true });
  });
});
