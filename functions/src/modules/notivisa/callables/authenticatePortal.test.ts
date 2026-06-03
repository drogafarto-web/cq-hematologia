/**
 * authenticatePortal.test.ts — Unit tests for NOTIVISA portal authentication
 * Phase 4 — Tests authentication flow, MFA validation, session creation, error handling
 *
 * Test patterns:
 * - Mock Firestore via `admin.firestore = jest.fn()`
 * - Mock HTTP requests via `nock` for portal API calls
 * - Verify session documents created with correct structure
 * - Validate error codes and messages
 */

import { authenticatePortal } from './authenticatePortal';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

describe('authenticatePortal', () => {
  let mockDb: any;
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock batch operations
    mockBatch = {
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Firestore
    mockDb = {
      batch: jest.fn().mockReturnValue(mockBatch),
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn(),
              set: jest.fn(),
            }),
          }),
          get: jest.fn(),
          set: jest.fn(),
        }),
      }),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockDb);
  });

  describe('Authentication Success Cases', () => {
    test('should authenticate user and return auth token', async () => {
      // GIVEN: Valid credentials and no MFA requirement
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: {
            modules: { notivisa: true },
          },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // Mock lab member check
      const memberDocMock = {
        exists: true,
        data: () => ({ active: true, role: 'RT' }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(memberDocMock);

      // Mock portal config
      const configDocMock = {
        exists: true,
        data: () => ({
          portalUrl: 'https://notivisa.inca.gov.br',
          requiresMfa: false,
        }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling authenticatePortal
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should return success response with auth token
      expect(result.ok).toBe(true);
      expect(result.authToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    test('should handle MFA successfully', async () => {
      // GIVEN: Valid credentials with MFA code
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: {
            modules: { notivisa: true },
          },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
          mfaCode: '123456',
        },
      };

      // Mock portal config with MFA required
      const configDocMock = {
        exists: true,
        data: () => ({
          portalUrl: 'https://notivisa.inca.gov.br',
          requiresMfa: true,
        }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling with valid MFA code
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should return success response
      expect(result.ok).toBe(true);
      expect(result.authToken).toBeDefined();
    });
  });

  describe('Authentication Error Cases', () => {
    test('should reject unauthenticated request', async () => {
      // GIVEN: Request without auth
      const request: Partial<CallableRequest<any>> = {
        auth: undefined,
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // WHEN: Calling authenticatePortal
      expect(async () => {
        await authenticatePortal(request as CallableRequest<any>);
      }).rejects.toThrow('unauthenticated');
    });

    test('should reject invalid credentials', async () => {
      // GIVEN: Invalid credentials format
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'a', // Too short
          portalPassword: 'pass', // Too short
        },
      };

      // WHEN: Calling with invalid credentials
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should return validation error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });

    test('should return MFA_REQUIRED when MFA is configured but code not provided', async () => {
      // GIVEN: Portal requires MFA but no code provided
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
          // mfaCode not provided
        },
      };

      // Mock portal config with MFA required
      const configDocMock = {
        exists: true,
        data: () => ({ requiresMfa: true }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling without MFA code
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should request MFA
      expect(result.ok).toBe(false);
      expect(result.code).toBe('MFA_REQUIRED');
    });

    test('should return PORTAL_CONFIG_MISSING if no configuration exists', async () => {
      // GIVEN: Lab has no portal configuration
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // Mock missing portal config
      const configDocMock = {
        exists: false,
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling with unconfigured lab
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should return configuration missing error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PORTAL_CONFIG_MISSING');
    });

    test('should return PERMISSION_DENIED if user lacks notivisa claim', async () => {
      // GIVEN: User without notivisa module claim
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: {
            modules: { notivisa: false }, // No access
          },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // WHEN: Calling without proper claims
      const result = await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should deny access
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Session Management', () => {
    test('should create session document with correct expiration', async () => {
      // GIVEN: Valid authentication request
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // Mock successful validation
      const configDocMock = {
        exists: true,
        data: () => ({ portalUrl: 'https://notivisa.inca.gov.br', requiresMfa: false }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling authenticatePortal
      await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should create session with batch.set call
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'active',
          createdAt: expect.any(Number),
          expiresAt: expect.any(Number),
        }),
      );
    });

    test('should log authentication attempt for audit trail', async () => {
      // GIVEN: Valid authentication
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      // Mock successful validation
      const configDocMock = {
        exists: true,
        data: () => ({ portalUrl: 'https://notivisa.inca.gov.br', requiresMfa: false }),
      };

      mockDb.collection().doc().collection().doc().get = jest.fn().mockResolvedValue(configDocMock);

      // WHEN: Calling authenticatePortal
      await authenticatePortal(request as CallableRequest<any>);

      // THEN: Should create audit log entry
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          action: 'PORTAL_LOGIN',
          operatorId: 'user123',
        }),
      );
    });
  });

  describe('Input Validation', () => {
    test('should validate labId is not empty', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: { uid: 'user123', token: { modules: { notivisa: true } } },
        data: {
          labId: '',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
        },
      };

      const result = await authenticatePortal(request as CallableRequest<any>);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });

    test('should validate MFA code format if provided', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: { uid: 'user123', token: { modules: { notivisa: true } } },
        data: {
          labId: 'lab-abc',
          portalUsername: 'operator001',
          portalPassword: 'securePassword123',
          mfaCode: 'invalid', // Not 6 digits
        },
      };

      const result = await authenticatePortal(request as CallableRequest<any>);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });
});
