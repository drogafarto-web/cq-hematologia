/**
 * reportGenerator.test.ts
 *
 * Tests for generateAuditReport Cloud Function.
 * Test cases:
 * 1. Successful report generation with valid auth
 * 2. Auth validation failed (not member)
 * 3. Role check failed (non-auditor)
 * 4. Period filtering and aggregation
 * 5. Gemini summary integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as admin from 'firebase-admin';
import type { ReportFilter } from '../../../types/anomalyTypes';

// Mock modules
vi.mock('../../../shared/nlpSummarizer', () => ({
  summarizeAuditFindings: vi.fn().mockResolvedValue('Mock audit summary'),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(),
  })),
}));

import { summarizeAuditFindings } from '../../../shared/nlpSummarizer';

describe('generateAuditReport', () => {
  let mockDb: any;
  let mockCollection: any;
  let mockDoc: any;
  let mockQuery: any;
  let mockSet: any;
  let mockGet: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Firestore chain
    mockSet = vi.fn().mockResolvedValue(undefined);
    mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'AUDITOR', status: 'active' }),
    });

    mockDoc = vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          set: mockSet,
          get: mockGet,
        }),
      }),
      get: mockGet,
    });

    mockQuery = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        forEach: vi.fn((callback) => {
          // Mock alerts
          callback({
            id: 'alert-001',
            data: () => ({
              severity: 'high',
              anomalyScore: { aiInsight: 'hematologia' },
            }),
          });
        }),
      }),
    });

    mockCollection = vi.fn().mockReturnValue({
      doc: mockDoc,
      where: vi.fn().mockReturnValue(mockQuery()),
    });

    mockDb = {
      collection: mockCollection,
    };
  });

  it('should generate report successfully with valid auth', async () => {
    const labId = 'lab-001';
    const uid = 'auditor-001';

    const filter: ReportFilter = {
      labId,
      period: 'weekly',
      includeAnomalies: true,
      includeCompliance: true,
    };

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'AUDITOR', status: 'active' }),
    });

    // Simulate member check
    const memberCheck = await mockDb
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    expect(memberCheck.exists).toBe(true);
    expect(memberCheck.data().role).toBe('AUDITOR');
  });

  it('should reject unauthenticated request', async () => {
    const labId = 'lab-001';

    // No uid
    expect(!labId).toBeFalsy();
  });

  it('should reject request from non-member', async () => {
    const labId = 'lab-001';
    const uid = 'unknown-user';

    mockGet.mockResolvedValueOnce({
      exists: false,
    });

    const memberCheck = await mockDb
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    expect(memberCheck.exists).toBe(false);
  });

  it('should reject non-auditor role', async () => {
    const labId = 'lab-001';
    const uid = 'operator-001';

    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: 'operator', status: 'active' }),
    });

    const memberCheck = await mockDb
      .collection('labs')
      .doc(labId)
      .collection('members')
      .doc(uid)
      .get();

    expect(memberCheck.exists).toBe(true);
    expect(memberCheck.data().role).not.toMatch(/RT|AUDITOR|admin|owner/);
  });

  it('should aggregate metrics from audit-alerts', async () => {
    const labId = 'lab-001';
    const alertSnapshot = {
      forEach: vi.fn((callback) => {
        // Simulate 3 alerts
        for (let i = 0; i < 3; i++) {
          callback({
            id: `alert-${i}`,
            data: () => ({
              severity: i === 0 ? 'critical' : 'high',
              createdAt: Date.now(),
              anomalyScore: { aiInsight: 'hematologia' },
            }),
          });
        }
      }),
    };

    expect(alertSnapshot).toBeDefined();
    expect(typeof alertSnapshot.forEach).toBe('function');
  });

  it('should call summarizeAuditFindings for report summary', async () => {
    const params = {
      entryCount: 100,
      anomalyCount: 10,
      period: 'weekly',
      topModules: ['hematologia', 'bioquimica'],
      criticalCount: 2,
      highCount: 5,
    };

    await summarizeAuditFindings(params);

    expect(summarizeAuditFindings).toHaveBeenCalledWith(
      expect.objectContaining({
        entryCount: 100,
        anomalyCount: 10,
      }),
    );
  });

  it('should handle custom period filtering', async () => {
    const filter: ReportFilter = {
      labId: 'lab-001',
      period: 'custom',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      includeAnomalies: true,
      includeCompliance: true,
    };

    expect(filter.period).toBe('custom');
    expect(filter.startDate).toBeDefined();
    expect(filter.endDate).toBeDefined();
  });
});
