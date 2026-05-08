/**
 * notivisa/http/client.test.ts — HTTP client tests
 *
 * Tests for NotivisaHTTPClient with mocked fetch
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NotivisaHTTPClient, NotivisaDraftPayload } from '../client';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as any).fetch = mockFetch;

describe('NotivisaHTTPClient', () => {
  let client: NotivisaHTTPClient;

  beforeEach(() => {
    client = new NotivisaHTTPClient('test-key', 'https://api.notivisa.test');
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitDraft', () => {
    it('should submit draft successfully', async () => {
      const mockPayload: NotivisaDraftPayload = {
        versao: '1.0',
        laudo_id: 'laudo-123',
        paciente_cpf: '12345678901',
        data_resultado: Date.now(),
        resultados: [
          {
            analito: 'Hemoglobina',
            valor: 13.5,
            unidade: 'g/dL',
            referencia: '12-16',
          },
        ],
        assinador: {
          cpf: '98765432100',
          nome: 'Dr. João',
          data_assinatura: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123' }),
      } as any);

      const result = await client.submitDraft('draft-1', mockPayload);

      expect(result).toHaveProperty('statusId');
      expect(result).toHaveProperty('submittedAt');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notivisa.test/api/v1/submissions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'X-Draft-ID': 'draft-1',
          }),
        }),
      );
    });

    it('should retry on server error (5xx)', async () => {
      const mockPayload: NotivisaDraftPayload = {
        versao: '1.0',
        laudo_id: 'laudo-123',
        paciente_cpf: '12345678901',
        data_resultado: Date.now(),
        resultados: [
          {
            analito: 'Hemoglobina',
            valor: 13.5,
            unidade: 'g/dL',
            referencia: '12-16',
          },
        ],
        assinador: {
          cpf: '98765432100',
          nome: 'Dr. João',
          data_assinatura: Date.now(),
        },
      };

      // Fail once, then succeed
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      } as any);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123' }),
      } as any);

      const result = await client.submitDraft('draft-1', mockPayload);

      expect(result).toHaveProperty('statusId');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should not retry on client error (4xx)', async () => {
      const mockPayload: NotivisaDraftPayload = {
        versao: '1.0',
        laudo_id: 'laudo-123',
        paciente_cpf: '12345678901',
        data_resultado: Date.now(),
        resultados: [
          {
            analito: 'Hemoglobina',
            valor: 13.5,
            unidade: 'g/dL',
            referencia: '12-16',
          },
        ],
        assinador: {
          cpf: '98765432100',
          nome: 'Dr. João',
          data_assinatura: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      } as any);

      const result = await client.submitDraft('draft-1', mockPayload);

      expect(result).toHaveProperty('status');
      expect((result as any).status).toBe('error');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries on 4xx
    });

    it('should retry on rate limit (429)', async () => {
      const mockPayload: NotivisaDraftPayload = {
        versao: '1.0',
        laudo_id: 'laudo-123',
        paciente_cpf: '12345678901',
        data_resultado: Date.now(),
        resultados: [
          {
            analito: 'Hemoglobina',
            valor: 13.5,
            unidade: 'g/dL',
            referencia: '12-16',
          },
        ],
        assinador: {
          cpf: '98765432100',
          nome: 'Dr. João',
          data_assinatura: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      } as any);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123' }),
      } as any);

      const result = await client.submitDraft('draft-1', mockPayload);

      expect(result).toHaveProperty('statusId');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Retried on 429
    });

    it('should handle timeout gracefully', async () => {
      const mockPayload: NotivisaDraftPayload = {
        versao: '1.0',
        laudo_id: 'laudo-123',
        paciente_cpf: '12345678901',
        data_resultado: Date.now(),
        resultados: [
          {
            analito: 'Hemoglobina',
            valor: 13.5,
            unidade: 'g/dL',
            referencia: '12-16',
          },
        ],
        assinador: {
          cpf: '98765432100',
          nome: 'Dr. João',
          data_assinatura: Date.now(),
        },
      };

      // Simulate timeout by aborting signal
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123' }),
      } as any);

      const result = await client.submitDraft('draft-1', mockPayload);

      expect(result).toHaveProperty('statusId');
      expect(mockFetch).toHaveBeenCalledTimes(2); // Retried on timeout
    });

    it(
      'should exhaust retries and return error',
      async () => {
        const mockPayload: NotivisaDraftPayload = {
          versao: '1.0',
          laudo_id: 'laudo-123',
          paciente_cpf: '12345678901',
          data_resultado: Date.now(),
          resultados: [
            {
              analito: 'Hemoglobina',
              valor: 13.5,
              unidade: 'g/dL',
              referencia: '12-16',
            },
          ],
          assinador: {
            cpf: '98765432100',
            nome: 'Dr. João',
            data_assinatura: Date.now(),
          },
        };

        // Always fail
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await client.submitDraft('draft-1', mockPayload);

        expect((result as any).status).toBe('error');
        expect((result as any).reason).toContain('Network error');
        expect((result as any).retryCount).toBe(5);
        expect(mockFetch).toHaveBeenCalledTimes(5); // All retries exhausted
      },
      30000, // Long timeout for backoff delays
    );
  });

  describe('checkStatus', () => {
    it('should check status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'approved',
        }),
      } as any);

      const result = await client.checkStatus('status-123');

      expect(result.status).toBe('approved');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notivisa.test/api/v1/submissions/status-123/status',
        expect.any(Object),
      );
    });

    it('should return pending status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'pending',
        }),
      } as any);

      const result = await client.checkStatus('status-123');

      expect(result.status).toBe('pending');
    });

    it(
      'should handle status check error',
      async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
        } as any);

        const result = await client.checkStatus('status-123');

        expect((result as any).status).toBe('error');
      },
      30000, // Long timeout for backoff delays
    );
  });

  describe('retrieveApproval', () => {
    it('should retrieve approval successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          approvalId: 'approval-123',
          approvedAt: Date.now(),
          certificateUrl: 'https://certs.notivisa.gov.br/cert-123.pdf',
        }),
      } as any);

      const result = await client.retrieveApproval('status-123');

      expect(result).toHaveProperty('approvalId');
      expect(result).toHaveProperty('certificateUrl');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notivisa.test/api/v1/submissions/status-123/approval',
        expect.any(Object),
      );
    });

    it('should handle approval retrieval error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      const result = await client.retrieveApproval('status-123');

      expect((result as any).status).toBe('error');
    });
  });

  describe('base URL handling', () => {
    it('should remove trailing slash from base URL', () => {
      const clientWithSlash = new NotivisaHTTPClient(
        'test-key',
        'https://api.notivisa.test/',
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending' }),
      } as any);

      clientWithSlash.checkStatus('status-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notivisa.test/api/v1/submissions/status-123/status',
        expect.any(Object),
      );
    });
  });

  describe('authorization header', () => {
    it('should include Bearer token in Authorization header', async () => {
      const clientWithToken = new NotivisaHTTPClient(
        'custom-secret-key',
        'https://api.test',
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending' }),
      } as any);

      await clientWithToken.checkStatus('status-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-secret-key',
          }),
        }),
      );
    });
  });
});
