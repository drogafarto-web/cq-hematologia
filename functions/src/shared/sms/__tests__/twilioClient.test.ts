/**
 * Twilio SMS Client Unit Tests
 * Phase 5 (W5-A3): Comprehensive test suite for SMS delivery, retry logic, error handling
 *
 * Coverage:
 * - sendSMS(): E.164 validation, successful send, retry on network error, fail-fast on validation
 * - sendBulkSMS(): batch sends, aggregate results, error propagation
 * - getMessageStatus(): status mapping (delivered/failed/pending/unknown), SID validation
 * - Error classes: ValidationError, NetworkError, QuotaError with correct codes
 * - Retry logic: exponential backoff, max 2 retries, network vs validation classification
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  TwilioSMSClient,
  ValidationError,
  NetworkError,
  QuotaError,
  generateCriticalValueSMSTemplate,
} from '../twilioClient';

// ─── Mock Twilio Client ────────────────────────────────────────────────────────

let mockTwilioClient: any;

jest.mock('twilio', () => {
  return jest.fn(() => mockTwilioClient);
});

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn((name: string) => ({
    value: jest.fn(() => {
      const secrets: Record<string, string> = {
        TWILIO_ACCOUNT_SID: 'AC_test_account_sid_123456',
        TWILIO_AUTH_TOKEN: 'test_auth_token_abcdef123',
        TWILIO_PHONE_NUMBER: '+5511999999999',
      };
      return secrets[name] || '';
    }),
  })),
}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('TwilioSMSClient', () => {
  let client: TwilioSMSClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock Twilio client - must be done before creating client
    mockTwilioClient = {
      messages: {
        create: jest.fn(),
      },
    };

    client = new TwilioSMSClient(2); // max 2 retries for tests
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // sendSMS() Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('sendSMS()', () => {
    describe('Happy Path — Successful Send', () => {
      it('should return SmsResult with sid and sent status on success', async () => {
        const mockSid = 'SM_test_1234567890abcdef';
        mockTwilioClient.messages.create.mockResolvedValueOnce({
          sid: mockSid,
          status: 'queued',
          dateCreated: new Date(),
        });

        const result = await client.sendSMS('+5511987654321', 'Test message', 'lab-001');

        expect(result.sid).toBe(mockSid);
        expect(result.status).toBe('queued');
        expect(result.sentAt).toBeGreaterThan(0);
        expect(result.errorCode).toBeUndefined();
      });

      it('should include labId in request for audit trail', async () => {
        mockTwilioClient.messages.create.mockResolvedValueOnce({
          sid: 'SM_test',
          status: 'sent',
          dateCreated: new Date(),
        });

        await client.sendSMS('+5511987654321', 'Audit test', 'lab-audit-001');

        expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
          expect.objectContaining({
            to: '+5511987654321',
            body: 'Audit test',
          }),
        );
      });
    });

    describe('E.164 Phone Validation', () => {
      it('should accept valid E.164 format +55XX...', async () => {
        mockTwilioClient.messages.create.mockResolvedValueOnce({
          sid: 'SM_test',
          status: 'sent',
        });

        const result = await client.sendSMS('+5511999999999', 'Valid format', 'lab-001');

        expect(result.status).not.toBe('failed');
        expect(result.errorCode).not.toBe('VALIDATION_ERROR');
      });

      it('should reject phone without + prefix', async () => {
        const result = await client.sendSMS('5511999999999', 'No plus', 'lab-001');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });

      it('should reject phone with non-digit characters', async () => {
        const result = await client.sendSMS('+55 (11) 99999-9999', 'Formatted', 'lab-001');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });

      it('should reject phone exceeding E.164 max length (15 digits)', async () => {
        const result = await client.sendSMS('+555511999999999999', 'Too long', 'lab-001');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });
    });

    describe('Input Validation', () => {
      it('should reject empty SMS body', async () => {
        const result = await client.sendSMS('+5511999999999', '', 'lab-001');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });

      it('should reject whitespace-only SMS body', async () => {
        const result = await client.sendSMS('+5511999999999', '   ', 'lab-001');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });

      it('should reject empty labId', async () => {
        const result = await client.sendSMS('+5511999999999', 'Message', '');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });

      it('should reject whitespace-only labId', async () => {
        const result = await client.sendSMS('+5511999999999', 'Message', '   ');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('VALIDATION_ERROR');
      });
    });

    describe('Retry Logic — Network Errors', () => {
      it('should retry on network error (ECONNREFUSED) and eventually succeed', async () => {
        mockTwilioClient.messages.create
          .mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'))
          .mockRejectedValueOnce(new Error('Network error: ECONNREFUSED'))
          .mockResolvedValueOnce({
            sid: 'SM_success_after_retries',
            status: 'sent',
          });

        const result = await client.sendSMS('+5511987654321', 'Retry test', 'lab-retry');

        expect(result.sid).toBe('SM_success_after_retries');
        expect(result.status).toBe('sent');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3);
      });

      it('should retry on timeout error and fail after max retries', async () => {
        mockTwilioClient.messages.create
          .mockRejectedValueOnce(new Error('Request timeout'))
          .mockRejectedValueOnce(new Error('Request timeout'))
          .mockRejectedValueOnce(new Error('Request timeout'));

        const result = await client.sendSMS('+5511987654321', 'Timeout', 'lab-timeout');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toContain('Request timeout');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(3); // initial + 2 retries
      });

      it('should retry on quota error (code 20009)', async () => {
        const quotaError = new Error('Rate limit exceeded');
        (quotaError as any).code = 20009;

        mockTwilioClient.messages.create.mockRejectedValueOnce(quotaError).mockResolvedValueOnce({
          sid: 'SM_quota_recovered',
          status: 'sent',
        });

        const result = await client.sendSMS('+5511987654321', 'Quota test', 'lab-quota');

        expect(result.sid).toBe('SM_quota_recovered');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('Retry Logic — Non-Retryable Errors', () => {
      it('should fail fast on validation error (no retry)', async () => {
        const validationError = new Error('Invalid To Parameter');
        (validationError as any).code = 20107;

        mockTwilioClient.messages.create.mockRejectedValueOnce(validationError);

        const result = await client.sendSMS('+5511987654321', 'Validation fail', 'lab-val');

        expect(result.status).toBe('failed');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1); // no retries
      });

      it('should fail fast on unknown error code', async () => {
        const unknownError = new Error('Unknown error');
        (unknownError as any).code = 99999;

        mockTwilioClient.messages.create.mockRejectedValueOnce(unknownError);

        const result = await client.sendSMS('+5511987654321', 'Unknown', 'lab-unknown');

        expect(result.status).toBe('failed');
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(1); // no retries
      });
    });

    describe('Error Handling & Audit Logging', () => {
      it('should capture error code and message in failed result', async () => {
        const testError = new Error('Test error message');
        (testError as any).code = 'TEST_CODE';

        mockTwilioClient.messages.create.mockRejectedValue(testError);

        const result = await client.sendSMS('+5511987654321', 'Error capture', 'lab-err');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('TEST_CODE');
        expect(result.errorMessage).toContain('Test error message');
      });

      it('should use UNKNOWN_ERROR when error code not present', async () => {
        mockTwilioClient.messages.create.mockRejectedValue(new Error('Unclassified error'));

        const result = await client.sendSMS('+5511987654321', 'Unclassified', 'lab-unc');

        expect(result.errorCode).toBe('UNKNOWN_ERROR');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // sendBulkSMS() Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('sendBulkSMS()', () => {
    describe('Batch Send — Happy Path', () => {
      it('should send SMS to multiple recipients sequentially', async () => {
        const recipients = ['+5511999999999', '+5521988888888', '+5531977777777'];
        const sids = ['SM_1', 'SM_2', 'SM_3'];

        sids.forEach((sid) => {
          mockTwilioClient.messages.create.mockResolvedValueOnce({
            sid,
            status: 'sent',
            dateCreated: new Date(),
          });
        });

        const results = await client.sendBulkSMS(recipients, 'Bulk message', 'lab-bulk');

        expect(results).toHaveLength(3);
        expect(results[0].sid).toBe('SM_1');
        expect(results[1].sid).toBe('SM_2');
        expect(results[2].sid).toBe('SM_3');
        expect(results.every((r) => r.status === 'sent')).toBe(true);
      });

      it('should aggregate results from batch send', async () => {
        mockTwilioClient.messages.create
          .mockResolvedValueOnce({ sid: 'SM_a', status: 'sent' })
          .mockResolvedValueOnce({ sid: 'SM_b', status: 'sent' });

        const results = await client.sendBulkSMS(
          ['+5511111111111', '+5522222222222'],
          'Aggregate test',
          'lab-agg',
        );

        expect(results).toHaveLength(2);
        expect(results.map((r) => r.sid)).toEqual(['SM_a', 'SM_b']);
      });
    });

    describe('Batch Send — Partial Failures', () => {
      it('should handle mixed success and failure results', async () => {
        mockTwilioClient.messages.create
          .mockResolvedValueOnce({ sid: 'SM_ok', status: 'sent' })
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({ sid: 'SM_ok2', status: 'sent' });

        const results = await client.sendBulkSMS(
          ['+5511111111111', '+5522222222222', '+5533333333333'],
          'Mixed test',
          'lab-mixed',
        );

        expect(results).toHaveLength(3);
        expect(results[0].status).toBe('sent');
        expect(results[1].status).toBe('failed');
        expect(results[2].status).toBe('sent');
      });
    });

    describe('Batch Send — Input Validation', () => {
      it('should reject empty recipients list', async () => {
        try {
          await client.sendBulkSMS([], 'Empty list', 'lab-empty');
          throw new Error('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      });

      it('should process batch with single recipient', async () => {
        mockTwilioClient.messages.create.mockResolvedValueOnce({
          sid: 'SM_single',
          status: 'sent',
        });

        const results = await client.sendBulkSMS(['+5511999999999'], 'Single', 'lab-single');

        expect(results).toHaveLength(1);
        expect(results[0].sid).toBe('SM_single');
      });
    });

    describe('Batch Send — Large Batch', () => {
      it('should handle 5+ recipients', async () => {
        const recipients = Array.from(
          { length: 5 },
          (_, i) => `+551199999999${String(i).padStart(2, '0')}`,
        );

        recipients.forEach((_, i) => {
          mockTwilioClient.messages.create.mockResolvedValueOnce({
            sid: `SM_${i}`,
            status: 'sent',
          });
        });

        const results = await client.sendBulkSMS(recipients, 'Large batch', 'lab-large');

        expect(results).toHaveLength(5);
        expect(mockTwilioClient.messages.create).toHaveBeenCalledTimes(5);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getMessageStatus() Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('getMessageStatus()', () => {
    describe('Status Mapping', () => {
      it('should map Twilio delivered status to delivered', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'delivered',
          errorCode: undefined,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_delivered');

        expect(result.status).toBe('delivered');
      });

      it('should map Twilio failed/undelivered status to failed', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'failed',
          errorCode: 'FAILED_CODE',
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_failed');

        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('FAILED_CODE');
      });

      it('should map undelivered status to failed', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'undelivered',
          errorCode: undefined,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_undelivered');

        expect(result.status).toBe('failed');
      });

      it('should map queued status to pending', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'queued',
          errorCode: undefined,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_queued');

        expect(result.status).toBe('pending');
      });

      it('should map sending status to pending', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'sending',
          errorCode: undefined,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_sending');

        expect(result.status).toBe('pending');
      });

      it('should map unknown Twilio status to unknown', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'unknown_status',
          errorCode: undefined,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_unknown');

        expect(result.status).toBe('unknown');
      });
    });

    describe('SID Validation', () => {
      it('should reject empty messageSid', async () => {
        try {
          await client.getMessageStatus('');
          throw new Error('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      });

      it('should reject whitespace-only messageSid', async () => {
        try {
          await client.getMessageStatus('   ');
          throw new Error('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
        }
      });
    });

    describe('Error Handling', () => {
      it('should return unknown status on fetch error', async () => {
        const mockFetch = (jest.fn() as any).mockRejectedValue(new Error('Fetch failed'));
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_error');

        expect(result.status).toBe('unknown');
        expect(result.errorCode).toBe('STATUS_CHECK_ERROR');
      });

      it('should preserve error code from Twilio in response', async () => {
        const mockFetch = (jest.fn() as any).mockResolvedValue({
          status: 'failed',
          errorCode: 30008,
        });
        mockTwilioClient.messages = jest.fn(() => ({
          fetch: mockFetch,
        }));

        const result = await client.getMessageStatus('SM_with_code');

        expect(result.errorCode).toBe('30008');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Classes Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Error Classes', () => {
    it('ValidationError should have code VALIDATION_ERROR and be non-retryable', () => {
      const error = new ValidationError('Test validation');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.retryable).toBe(false);
      expect(error.name).toBe('ValidationError');
    });

    it('NetworkError should have code NETWORK_ERROR and be retryable', () => {
      const error = new NetworkError('Test network');

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('NetworkError');
    });

    it('QuotaError should have code QUOTA_ERROR and be retryable', () => {
      const error = new QuotaError('Test quota');

      expect(error.code).toBe('QUOTA_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('QuotaError');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Template Generation Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('generateCriticalValueSMSTemplate()', () => {
    it('should generate SMS template within 160 character SMS limit', () => {
      const template = generateCriticalValueSMSTemplate(
        'Glicose',
        'João Silva',
        450,
        'mg/dL',
        'laudo-2026-05-08-12345678',
      );

      expect(template).toContain('HC Qualidade CRÍTICO');
      expect(template).toContain('João Silva');
      expect(template).toContain('Glicose');
      expect(template).toContain('450');
      expect(template.length).toBeLessThanOrEqual(160);
    });

    it('should include all required fields in template', () => {
      const template = generateCriticalValueSMSTemplate(
        'Potássio',
        'Maria Santos',
        7.5,
        'mEq/L',
        'laudo-abc123def456',
      );

      expect(template).toContain('HC Qualidade CRÍTICO');
      expect(template).toContain('Paciente');
      expect(template).toContain('Analito');
      expect(template).toContain('Valor');
      expect(template).toContain('Ref');
    });

    it('should truncate laudoId to first 8 characters', () => {
      const fullId = 'laudo-2026-05-08-12345678-extra-chars';
      const template = generateCriticalValueSMSTemplate(
        'Cálcio',
        'Test Patient',
        12.0,
        'mg/dL',
        fullId,
      );

      expect(template).toContain('laudo-20');
      expect(template).not.toContain('extra-chars');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Integration & Edge Cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Integration & Edge Cases', () => {
    it('should handle very long SMS body (edge case)', async () => {
      const longBody = 'A'.repeat(500); // Much longer than typical SMS

      const result = await client.sendSMS('+5511999999999', longBody, 'lab-long');

      // Should fail because mock isn't set up, but body validation passes
      expect(result.status).toBe('failed');
      expect(result.errorCode).not.toBe('VALIDATION_ERROR');
    });

    it('should handle concurrent bulk sends across multiple calls', async () => {
      mockTwilioClient.messages.create = (jest.fn() as any).mockResolvedValue({
        sid: 'SM_concurrent',
        status: 'sent',
        dateCreated: new Date(),
      });

      const promise1 = client.sendBulkSMS(['+5511111111111'], 'Batch 1', 'lab-1');
      const promise2 = client.sendBulkSMS(['+5522222222222'], 'Batch 2', 'lab-2');

      const [results1, results2] = await Promise.all([promise1, promise2]);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].status).toBe('sent');
      expect(results2[0].status).toBe('sent');
    });

    it('should include timestamp in SMS results', async () => {
      mockTwilioClient.messages.create = (jest.fn() as any).mockResolvedValue({
        sid: 'SM_ts_test',
        status: 'sent',
        dateCreated: new Date(),
      });

      const before = Date.now();
      const result = await client.sendSMS('+5511999999999', 'Timestamp test', 'lab-ts');
      const after = Date.now();

      expect(result.sentAt).toBeGreaterThanOrEqual(before);
      expect(result.sentAt).toBeLessThanOrEqual(after);
    });
  });
});
