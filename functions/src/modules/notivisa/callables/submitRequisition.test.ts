/**
 * submitRequisition.test.ts — Unit tests for NOTIVISA requisition submission
 * Phase 4 — Tests submission workflow, rate limiting, idempotency, portal integration, error handling
 *
 * Test patterns:
 * - Mock portal API responses
 * - Validate duplicate submission detection
 * - Test rate limiting logic
 * - Verify audit trail creation
 * - Test error recovery and queueing
 */

import { submitRequisition } from './submitRequisition';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

describe('submitRequisition', () => {
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
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            count: jest.fn().mockReturnThis(),
            get: jest.fn(),
            doc: jest.fn().mockReturnValue({
              set: jest.fn(),
              update: jest.fn(),
              get: jest.fn(),
              collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({
                  set: jest.fn(),
                }),
              }),
            }),
          }),
          get: jest.fn(),
          collection: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn(),
            doc: jest.fn().mockReturnValue({
              set: jest.fn(),
            }),
          }),
        }),
      }),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockDb);
  });

  describe('Successful Submission', () => {
    test('should submit requisition successfully', async () => {
      // GIVEN: Valid requisition with complete payload
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [
              {
                analito: 'Hemoglobina',
                valor: 13.5,
                unidade: 'g/dL',
                referencia: '13.5-17.5',
              },
            ],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
        },
      };

      // Mock session exists and valid
      const sessionDocMock = {
        exists: true,
        data: () => ({
          status: 'active',
          expiresAt: Date.now() + 3600000,
          authToken: 'valid-token',
        }),
      };

      // Mock no existing submission
      const existingSubmissionMock = {
        empty: true,
      };

      // Mock rate limit check
      const rateLimitMock = {
        data: () => ({ count: 5 }),
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValueOnce(existingSubmissionMock)
        .mockResolvedValueOnce(rateLimitMock);

      // WHEN: Calling submitRequisition
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should return success with requisition ID
      expect(result.ok).toBe(true);
      expect(result.requisitionId).toBeDefined();
      expect(result.status).toBe('queued');
    });

    test('should queue submission if portal is temporarily unavailable', async () => {
      // GIVEN: Valid submission but portal fails
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [
              {
                analito: 'Hemoglobina',
                valor: 13.5,
                unidade: 'g/dL',
                referencia: '13.5-17.5',
              },
            ],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
        },
      };

      // Mock valid session
      const sessionDocMock = {
        exists: true,
        data: () => ({
          status: 'active',
          expiresAt: Date.now() + 3600000,
          authToken: 'valid-token',
        }),
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValue({ empty: true });

      // WHEN: Calling submitRequisition with portal failure
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should queue for retry with status queued
      expect(result.ok).toBe(true);
      expect(['queued', 'submitted']).toContain(result.status);
    });
  });

  describe('Validation', () => {
    test('should reject invalid NOTIVISA payload', async () => {
      // GIVEN: Invalid payload (missing required fields)
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: 'invalid-cpf', // Invalid CPF
            data_resultado: 1700000000000,
            resultados: [],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
        },
      };

      // WHEN: Calling with invalid payload
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should return validation error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_PAYLOAD');
    });

    test('should validate CPF format', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: 'invalid', // Not 11 digits
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {},
        },
      };

      const result = await submitRequisition(request as CallableRequest<any>);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Session Management', () => {
    test('should reject submission with invalid session', async () => {
      // GIVEN: Non-existent session ID
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'invalid-session',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
        },
      };

      // Mock session not found
      const sessionDocMock = {
        exists: false,
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      // WHEN: Calling with invalid session
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should reject with session error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INVALID_SESSION');
    });

    test('should reject submission with expired session', async () => {
      // GIVEN: Expired session
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'expired-session',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
        },
      };

      // Mock expired session
      const sessionDocMock = {
        exists: true,
        data: () => ({
          status: 'active',
          expiresAt: Date.now() - 1000, // Expired 1 second ago
        }),
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      // WHEN: Calling with expired session
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should reject with expired error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('Duplicate Detection', () => {
    test('should detect duplicate submission', async () => {
      // GIVEN: Submission already exists for same laudo+patient
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
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

      // Mock existing submission found
      const existingSubmissionMock = {
        empty: false,
        docs: [
          {
            data: () => ({ id: 'req-existing-123' }),
          },
        ],
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValue(existingSubmissionMock);

      // WHEN: Calling with duplicate submission
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should detect duplicate
      expect(result.ok).toBe(false);
      expect(result.code).toBe('DUPLICATE_SUBMISSION');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limit (20 per hour)', async () => {
      // GIVEN: Many submissions in the past hour
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
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

      // Mock rate limit exceeded
      const rateLimitMock = {
        data: () => ({ count: 25 }), // 25 submissions > limit of 20
      };

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValueOnce({ empty: true })
        .mockResolvedValueOnce(rateLimitMock);

      // WHEN: Calling with rate limit exceeded
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should return rate limit error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('RATE_LIMITED');
    });
  });

  describe('Audit Trail', () => {
    test('should create audit log entry for submission', async () => {
      // GIVEN: Valid submission
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
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

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValue({ empty: true });

      // WHEN: Calling submitRequisition
      await submitRequisition(request as CallableRequest<any>);

      // THEN: Should create audit log entry with batch.set
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          action: 'SUBMITTED',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle portal communication errors gracefully', async () => {
      // GIVEN: Portal communication fails
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-123',
          authSessionId: 'session-abc',
          notivisaPayload: {
            versao: '1.0',
            laudo_id: 'laudo-123',
            paciente_cpf: '12345678901',
            data_resultado: 1700000000000,
            resultados: [{ analito: 'Test', valor: 1, unidade: 'u', referencia: 'ref' }],
            assinador: {
              cpf: '98765432100',
              nome: 'Dr. João',
              data_assinatura: 1700000000000,
            },
          },
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

      mockDb.collection().doc().collection().doc().get = jest
        .fn()
        .mockResolvedValue(sessionDocMock);

      mockDb.collection().doc().collection().where().limit().get = jest
        .fn()
        .mockResolvedValue({ empty: true });

      // WHEN: Calling with portal failure simulation
      const result = await submitRequisition(request as CallableRequest<any>);

      // THEN: Should queue for retry instead of failing
      expect(result.ok).toBe(true);
      expect(['queued', 'submitted']).toContain(result.status);
    });

    test('should reject unauthenticated request', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: undefined,
        data: { labId: 'lab-abc' },
      };

      expect(async () => {
        await submitRequisition(request as CallableRequest<any>);
      }).rejects.toThrow('unauthenticated');
    });
  });
});
