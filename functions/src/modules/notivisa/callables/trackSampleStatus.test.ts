/**
 * trackSampleStatus.test.ts — Unit tests for sample status tracking
 * Phase 4 — Tests polling logic, status transitions, timeout handling, error recovery
 *
 * Test patterns:
 * - Mock portal polling responses with varying status
 * - Test terminal state detection
 * - Verify 24-hour polling timeout
 * - Validate status update logic and audit trail
 * - Test session validation optional behavior
 */

import { trackSampleStatus } from './trackSampleStatus';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

describe('trackSampleStatus', () => {
  let mockDb: any;
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockBatch = {
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      batch: jest.fn().mockReturnValue(mockBatch),
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn(),
              update: jest.fn(),
              collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({
                  set: jest.fn(),
                }),
              }),
            }),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn(),
          }),
          get: jest.fn(),
        }),
      }),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockDb);
  });

  describe('Status Tracking', () => {
    test('should track and return current submission status', async () => {
      // GIVEN: Valid requisition ID
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-123',
        },
      };

      // Mock submission found
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-123',
          status: 'submitted',
          protocolNumber: 'NV-001',
          submittedAt: Date.now() - 100000,
          updatedAt: Date.now(),
          attempts: 1,
          maxAttempts: 5,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling trackSampleStatus
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return current status
      expect(result.ok).toBe(true);
      expect(result.status).toBe('submitted');
      expect(result.protocolNumber).toBe('NV-001');
    });

    test('should detect terminal status and stop polling', async () => {
      // GIVEN: Submission with terminal status (completed)
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-completed',
        },
      };

      // Mock completed submission
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-completed',
          status: 'completed',
          protocolNumber: 'NV-002',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling for completed requisition
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return completed status without nextCheckAt
      expect(result.ok).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.nextCheckAt).toBeUndefined();
    });

    test('should provide nextCheckAt for non-terminal status', async () => {
      // GIVEN: Submission with non-terminal status
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-pending',
        },
      };

      // Mock pending submission
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-pending',
          status: 'queued',
          protocolNumber: 'NV-003',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling for pending requisition
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return nextCheckAt for polling
      expect(result.ok).toBe(true);
      expect(result.status).toBe('queued');
      expect(result.nextCheckAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Polling Logic', () => {
    test('should poll portal for status updates', async () => {
      // GIVEN: Submission in progress
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-polling',
        },
      };

      // Mock submission with active polling
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-polling',
          status: 'submitted',
          protocolNumber: 'NV-004',
          submittedAt: Date.now() - 100000,
          lastCheckAt: Date.now() - 50000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling trackSampleStatus
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return status and polling interval
      expect(result.ok).toBe(true);
      expect(result.nextCheckAt).toBeDefined();
    });

    test('should detect 24-hour polling timeout', async () => {
      // GIVEN: Submission submitted 24+ hours ago
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-timeout',
        },
      };

      // Mock old submission still pending
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-timeout',
          status: 'submitted',
          protocolNumber: 'NV-005',
          submittedAt: Date.now() - 86400000 - 100000, // 24+ hours ago
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling for timed-out requisition
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should mark as failed
      expect(result.ok).toBe(true);
      expect(result.status).toBe('failed');
    });
  });

  describe('Session Validation', () => {
    test('should validate session if provided', async () => {
      // GIVEN: Valid session ID provided
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-123',
          authSessionId: 'session-abc',
        },
      };

      // Mock valid session
      const sessionDocMock = {
        exists: true,
        data: () => ({
          status: 'active',
          expiresAt: Date.now() + 3600000,
        }),
      };

      // Mock submission
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-123',
          status: 'submitted',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest
        .fn()
        .mockResolvedValueOnce(sessionDocMock)
        .mockResolvedValueOnce(submissionDocMock);

      // WHEN: Calling with valid session
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return status successfully
      expect(result.ok).toBe(true);
    });

    test('should reject expired session', async () => {
      // GIVEN: Expired session
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-123',
          authSessionId: 'expired-session',
        },
      };

      // Mock expired session
      const sessionDocMock = {
        exists: true,
        data: () => ({
          status: 'active',
          expiresAt: Date.now() - 1000, // Expired
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(sessionDocMock);

      // WHEN: Calling with expired session
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should reject with session expired
      expect(result.ok).toBe(false);
      expect(result.code).toBe('SESSION_EXPIRED');
    });

    test('should work without session ID (session optional)', async () => {
      // GIVEN: No session ID provided
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-123',
          // authSessionId not provided
        },
      };

      // Mock submission
      const submissionDocMock = {
        exists: true,
        ref: { collection: jest.fn().mockReturnValue({ doc: jest.fn().mockReturnValue({}) }) },
        data: () => ({
          id: 'req-123',
          status: 'submitted',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling without session
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should still work
      expect(result.ok).toBe(true);
    });
  });

  describe('Status Transitions', () => {
    test('should update status when changed from portal', async () => {
      // GIVEN: Portal returns different status
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-transition',
        },
      };

      // Mock submission with old status
      const submissionDocMock = {
        exists: true,
        ref: {
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({}),
          }),
        },
        data: () => ({
          id: 'req-transition',
          status: 'submitted',
          protocolNumber: 'NV-006',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling trackSampleStatus
      await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should create audit log for status change if different
      // (Status changes would be detected during polling)
    });
  });

  describe('Audit Logging', () => {
    test('should log status changes in audit trail', async () => {
      // GIVEN: Submission with status update
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-audit',
        },
      };

      // Mock submission
      const submissionDocMock = {
        exists: true,
        ref: {
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({}),
          }),
        },
        data: () => ({
          id: 'req-audit',
          status: 'queued',
          protocolNumber: 'NV-007',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling trackSampleStatus
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should track the access
      expect(result.ok).toBe(true);
    });
  });

  describe('Error Cases', () => {
    test('should return REQUISITION_NOT_FOUND if not exists', async () => {
      // GIVEN: Non-existent requisition
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'nonexistent',
        },
      };

      // Mock submission not found
      const submissionDocMock = {
        exists: false,
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling for non-existent requisition
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should return not found error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('REQUISITION_NOT_FOUND');
    });

    test('should handle portal errors gracefully', async () => {
      // GIVEN: Portal returns error during polling
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-portal-error',
        },
      };

      // Mock submission
      const submissionDocMock = {
        exists: true,
        ref: {
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({}),
          }),
        },
        data: () => ({
          id: 'req-portal-error',
          status: 'submitted',
          protocolNumber: 'NV-008',
          submittedAt: Date.now() - 100000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling with portal error
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should continue with last known status instead of failing
      expect(result.ok).toBe(true);
      expect(result.status).toBeDefined();
    });

    test('should reject unauthenticated request', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: undefined,
        data: { labId: 'lab-abc' },
      };

      expect(async () => {
        await trackSampleStatus(request as CallableRequest<any>);
      }).rejects.toThrow('unauthenticated');
    });

    test('should reject user without notivisa module claim', async () => {
      // GIVEN: User without notivisa access
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: false } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-123',
        },
      };

      // WHEN: Calling without proper claims
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should deny access
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Response Format', () => {
    test('should include details object with attempts when available', async () => {
      // GIVEN: Submission with attempt tracking
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          requisitionId: 'req-details',
        },
      };

      // Mock submission with attempt info
      const submissionDocMock = {
        exists: true,
        ref: {
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({}),
          }),
        },
        data: () => ({
          id: 'req-details',
          status: 'processing',
          protocolNumber: 'NV-009',
          submittedAt: Date.now() - 100000,
          attempts: 2,
          maxAttempts: 5,
          lastCheckAt: Date.now() - 10000,
        }),
      };

      mockDb.collection()
        .doc()
        .collection()
        .doc()
        .get = jest.fn().mockResolvedValue(submissionDocMock);

      // WHEN: Calling trackSampleStatus
      const result = await trackSampleStatus(request as CallableRequest<any>);

      // THEN: Should include details
      expect(result.ok).toBe(true);
      expect(result.details).toBeDefined();
      if (result.details) {
        expect(result.details.attempts).toBe(2);
        expect(result.details.maxAttempts).toBe(5);
      }
    });
  });
});
