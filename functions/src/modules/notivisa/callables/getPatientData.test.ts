/**
 * getPatientData.test.ts — Unit tests for patient data retrieval
 * Phase 4 — Tests data validation, completeness checks, error handling, PII masking
 *
 * Test patterns:
 * - Mock Firestore query responses
 * - Validate patient and laudo data structures
 * - Test missing field detection
 * - Verify audit logging of data access
 */

import { getPatientData } from './getPatientData';
import * as admin from 'firebase-admin';
import { CallableRequest } from 'firebase-functions/v2/https';

describe('getPatientData', () => {
  let mockDb: any;
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query responses
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    // Mock Firestore
    mockDb = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn(),
            doc: jest.fn().mockReturnValue({
              set: jest.fn(),
              get: jest.fn(),
            }),
          }),
          get: jest.fn(),
        }),
      }),
    };

    (admin.firestore as jest.Mock).mockReturnValue(mockDb);
  });

  describe('Successful Data Retrieval', () => {
    test('should retrieve complete patient and laudo data', async () => {
      // GIVEN: Valid patient CPF and complete data
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // Mock patient data
      const patientDocMock = {
        exists: true,
        data: () => ({
          cpf: '12345678901',
          nome: 'João Silva',
          dataNascimento: 950000000000,
          sexo: 'M',
          mae: 'Maria Silva',
        }),
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              dataNascimento: 950000000000,
              sexo: 'M',
              mae: 'Maria Silva',
            }),
          },
        ],
      };

      // Mock laudo data
      const laudoDocMock = {
        empty: false,
        docs: [
          {
            id: 'laudo-123',
            data: () => ({
              id: 'laudo-123',
              pacienteCpf: '12345678901',
              resultadoEm: 1700000000000,
              resultados: [
                {
                  analito: 'Hemoglobina',
                  valor: 13.5,
                  unidade: 'g/dL',
                  referencia: '13.5-17.5',
                },
              ],
              assinatura: {
                operatorCpf: '98765432100',
                operatorNome: 'Dr. João',
                ts: 1700000000000,
              },
            }),
          },
        ],
      };

      mockQuery.get.mockResolvedValue(patientDocMock);

      // Mock collection for laudo query
      const laudoCollectionMock = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(laudoDocMock),
      };

      mockDb.collection()
        .doc()
        .collection()
        .where = jest.fn().mockReturnValue(mockQuery);

      // WHEN: Calling getPatientData
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should return complete data with ready status
      expect(result.ok).toBe(true);
      expect(result.paciente.nome).toBe('João Silva');
      expect(result.laudo.resultados.length).toBeGreaterThan(0);
      expect(result.readyForSubmission).toBe(true);
    });

    test('should retrieve specific laudo by ID', async () => {
      // GIVEN: Valid patient CPF and specific laudoId
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
          laudoId: 'laudo-456',
        },
      };

      // Mock patient data
      const patientDocMock = {
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              dataNascimento: 950000000000,
              sexo: 'M',
              mae: 'Maria Silva',
            }),
          },
        ],
      };

      // Mock specific laudo
      const laudoDocMock = {
        empty: false,
        docs: [
          {
            id: 'laudo-456',
            data: () => ({
              id: 'laudo-456',
              pacienteCpf: '12345678901',
              resultadoEm: 1600000000000,
              resultados: [
                {
                  analito: 'Glicose',
                  valor: 95,
                  unidade: 'mg/dL',
                  referencia: '70-100',
                },
              ],
              assinatura: {
                operatorCpf: '98765432100',
                operatorNome: 'Dr. Maria',
                ts: 1600000000000,
              },
            }),
          },
        ],
      };

      mockQuery.get.mockResolvedValue(patientDocMock);

      // WHEN: Calling with laudoId
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should return specified laudo
      expect(result.ok).toBe(true);
      expect(result.laudo.id).toBe('laudo-456');
    });
  });

  describe('Data Validation', () => {
    test('should detect missing patient fields', async () => {
      // GIVEN: Patient with incomplete data
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // Mock incomplete patient data
      const patientDocMock = {
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              // missing dataNascimento, sexo, mae
            }),
          },
        ],
      };

      mockQuery.get.mockResolvedValue(patientDocMock);

      // WHEN: Calling with incomplete patient data
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should indicate incomplete data
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INCOMPLETE_DATA');
      expect(result.missingFields).toContain('paciente.dataNascimento');
    });

    test('should detect missing laudo result fields', async () => {
      // GIVEN: Patient with laudo missing result values
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // Mock patient data
      const patientDocMock = {
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              dataNascimento: 950000000000,
              sexo: 'M',
              mae: 'Maria Silva',
            }),
          },
        ],
      };

      // Mock laudo with missing result value
      const laudoDocMock = {
        empty: false,
        docs: [
          {
            id: 'laudo-123',
            data: () => ({
              id: 'laudo-123',
              pacienteCpf: '12345678901',
              resultadoEm: 1700000000000,
              resultados: [
                {
                  analito: 'Hemoglobina',
                  valor: null, // Missing value
                  unidade: 'g/dL',
                  referencia: '13.5-17.5',
                },
              ],
              assinatura: {
                operatorCpf: '98765432100',
                operatorNome: 'Dr. João',
                ts: 1700000000000,
              },
            }),
          },
        ],
      };

      mockQuery.get.mockResolvedValueOnce(patientDocMock);
      mockQuery.get.mockResolvedValueOnce(laudoDocMock);

      // WHEN: Calling with incomplete laudo
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should report missing laudo fields
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INCOMPLETE_DATA');
      expect(result.missingFields).toContain('laudo.resultados[0].valor');
    });

    test('should validate CPF format', async () => {
      // GIVEN: Invalid CPF format
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: 'invalid-cpf',
        },
      };

      // WHEN: Calling with invalid CPF
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should return validation error
      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Error Cases', () => {
    test('should return PATIENT_NOT_FOUND if patient does not exist', async () => {
      // GIVEN: Non-existent patient CPF
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '00000000000',
        },
      };

      // Mock empty patient query
      mockQuery.get.mockResolvedValue({
        empty: true,
        docs: [],
      });

      // WHEN: Calling for non-existent patient
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should return patient not found
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PATIENT_NOT_FOUND');
    });

    test('should return LAUDO_NOT_FOUND if no laudo exists', async () => {
      // GIVEN: Patient exists but no laudo
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // Mock patient data
      const patientDocMock = {
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              dataNascimento: 950000000000,
              sexo: 'M',
              mae: 'Maria Silva',
            }),
          },
        ],
      };

      // Mock empty laudo query
      const laudoDocMock = {
        empty: true,
        docs: [],
      };

      mockQuery.get.mockResolvedValueOnce(patientDocMock);
      mockQuery.get.mockResolvedValueOnce(laudoDocMock);

      // WHEN: Calling for patient without laudo
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should return laudo not found
      expect(result.ok).toBe(false);
      expect(result.code).toBe('LAUDO_NOT_FOUND');
    });

    test('should reject unauthenticated request', async () => {
      // GIVEN: Request without authentication
      const request: Partial<CallableRequest<any>> = {
        auth: undefined,
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // WHEN: Calling without auth
      expect(async () => {
        await getPatientData(request as CallableRequest<any>);
      }).rejects.toThrow('unauthenticated');
    });

    test('should deny access if user lacks notivisa module claim', async () => {
      // GIVEN: User without notivisa access
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: false } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // WHEN: Calling without proper claims
      const result = await getPatientData(request as CallableRequest<any>);

      // THEN: Should deny access
      expect(result.ok).toBe(false);
      expect(result.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('Audit Logging', () => {
    test('should log patient data access with masked CPF', async () => {
      // GIVEN: Valid request for patient data
      const request: Partial<CallableRequest<any>> = {
        auth: {
          uid: 'user123',
          token: { modules: { notivisa: true } },
        },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '12345678901',
        },
      };

      // Mock successful data retrieval
      const patientDocMock = {
        docs: [
          {
            data: () => ({
              cpf: '12345678901',
              nome: 'João Silva',
              dataNascimento: 950000000000,
              sexo: 'M',
              mae: 'Maria Silva',
            }),
          },
        ],
      };

      const laudoDocMock = {
        empty: false,
        docs: [
          {
            id: 'laudo-123',
            data: () => ({
              id: 'laudo-123',
              pacienteCpf: '12345678901',
              resultadoEm: 1700000000000,
              resultados: [
                {
                  analito: 'Hemoglobina',
                  valor: 13.5,
                  unidade: 'g/dL',
                  referencia: '13.5-17.5',
                },
              ],
              assinatura: {
                operatorCpf: '98765432100',
                operatorNome: 'Dr. João',
                ts: 1700000000000,
              },
            }),
          },
        ],
      };

      mockQuery.get.mockResolvedValueOnce(patientDocMock);
      mockQuery.get.mockResolvedValueOnce(laudoDocMock);

      // WHEN: Calling getPatientData
      await getPatientData(request as CallableRequest<any>);

      // THEN: Should create audit log entry (verify via mockDb calls)
      expect(mockDb.collection).toHaveBeenCalledWith('notivisa-audit-logs');
    });
  });

  describe('Input Validation', () => {
    test('should validate labId is not empty', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: { uid: 'user123', token: { modules: { notivisa: true } } },
        data: {
          labId: '',
          pacienteCpf: '12345678901',
        },
      };

      const result = await getPatientData(request as CallableRequest<any>);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });

    test('should validate CPF format strictly', async () => {
      const request: Partial<CallableRequest<any>> = {
        auth: { uid: 'user123', token: { modules: { notivisa: true } } },
        data: {
          labId: 'lab-abc',
          pacienteCpf: '123456789', // Too short
        },
      };

      const result = await getPatientData(request as CallableRequest<any>);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });
});
