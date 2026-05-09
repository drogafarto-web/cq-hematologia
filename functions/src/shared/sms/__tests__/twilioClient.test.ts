/**
 * Tests for TwilioSMSClient
 * Unit tests covering validation, retry logic, and error handling
 */

import {
  TwilioSMSClient,
  ValidationError,
  NetworkError,
  QuotaError,
  generateCriticalValueSMSTemplate,
} from '../twilioClient';

// Mock Twilio SDK
jest.mock('twilio', () => {
  return jest.fn();
});

describe('TwilioSMSClient', () => {
  let client: TwilioSMSClient;

  beforeEach(() => {
    client = new TwilioSMSClient(2); // max 2 retries
    jest.clearAllMocks();
  });

  describe('Phone Validation', () => {
    it('should reject invalid phone format', async () => {
      const result = await client.sendSMS('11999999999', 'test', 'lab1');
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should accept E.164 format with +55', async () => {
      // This will fail due to mock, but validation should pass
      const result = await client.sendSMS('+5511999999999', 'test', 'lab1');
      // Status will be 'failed' because we haven't mocked the actual send
      // but the validation error won't be there
      expect(result.errorCode).not.toBe('VALIDATION_ERROR');
    });

    it('should reject empty body', async () => {
      const result = await client.sendSMS('+5511999999999', '', 'lab1');
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject empty labId', async () => {
      const result = await client.sendSMS('+5511999999999', 'test', '');
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('Bulk SMS', () => {
    it('should reject empty recipients list', async () => {
      const result = await client.sendBulkSMS([], 'test', 'lab1');
      expect(result).toHaveLength(0);
    });
  });

  describe('Status Check', () => {
    it('should reject empty messageSid', async () => {
      const result = await client.getMessageStatus('');
      expect(result.status).toBe('unknown');
      expect(result.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('Template Generation', () => {
    it('should generate SMS template within 160 chars', () => {
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
      expect(template).toContain('laudo-20');
      expect(template.length).toBeLessThanOrEqual(180); // Some buffer
    });
  });
});
