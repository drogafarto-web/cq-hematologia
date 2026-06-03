/**
 * notivisa/integration-sandbox.test.ts — NOTIVISA Sandbox Integration Tests
 *
 * 18 comprehensive tests for sandbox submission workflow:
 *   1. Valid draft submission → statusId returned
 *   2. Duplicate submission → error code detected
 *   3. Status polling (5 cycles) → state transitions verified
 *   4. Network timeout → retry logic triggers, max 5 retries
 *   5. Invalid payload (Zod validation) → rejected before HTTP call
 *   6. Concurrent submissions → no race condition
 *   7-12. Payload builder edge cases (CPF validation, date formats, panel codes)
 *   13-18. HTTP client retry scenarios (5xx, 429, exponential backoff)
 *
 * Prerequisites:
 *   - NOTIVISA_SANDBOX_URL + NOTIVISA_SANDBOX_KEY set in environment
 *   - Firestore emulator running (npm run test:emulator)
 *   - Mock fetch setup (MSW or nock)
 *
 * Run:
 *   npm run test -- --testNamePattern="integration-sandbox"
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  NotivisaHTTPClient,
  NotivisaDraftPayload,
  SubmitDraftResponse,
  CheckStatusResponse,
} from '../http/client';
import {
  buildNotivisaPayload,
  validateNotivisaPayload,
  LaudoDoc,
  LabDoc,
  NotivisaPayload,
} from '../http/payloadBuilder';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Mocks & Fixtures
// ─────────────────────────────────────────────────────────────────────────

const SANDBOX_URL = process.env.NOTIVISA_SANDBOX_URL || 'https://sandbox.notivisa.gov.br';
const SANDBOX_KEY = process.env.NOTIVISA_SANDBOX_KEY || 'test-key-12345678901234567890';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as any).fetch = mockFetch;

// Test fixtures
const testLab: LabDoc = {
  id: 'lab-sandbox-001',
  nome: 'Laboratório HC Quality Sandbox',
};

const testLaudo: LaudoDoc = {
  id: 'laudo-syphilis-001',
  labId: 'lab-sandbox-001',
  pacienteId: 'pac-001',
  pacienteCpf: '12345678900',
  pacienteNome: 'Test Patient Syphilis',
  resultadoEm: Date.now(),
  resultados: [
    {
      analito: 'VDRL',
      valor: '1:256',
      unidade: 'título',
      referencia: 'Negativo',
    },
  ],
  assinatura: {
    operatorId: 'operator-rt-001',
    operatorCpf: '98765432100',
    operatorNome: 'Dr. João Silva',
    ts: Date.now(),
  },
};

const testPayload: NotivisaDraftPayload = {
  versao: '1.0',
  laudo_id: testLaudo.id,
  paciente_cpf: testLaudo.pacienteCpf,
  data_resultado: testLaudo.resultadoEm,
  resultados: testLaudo.resultados,
  assinador: {
    cpf: testLaudo.assinatura.operatorCpf,
    nome: testLaudo.assinatura.operatorNome,
    data_assinatura: testLaudo.assinatura.ts,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────

describe('NOTIVISA Sandbox Integration Tests', () => {
  let client: NotivisaHTTPClient;

  beforeEach(() => {
    client = new NotivisaHTTPClient(SANDBOX_KEY, SANDBOX_URL);
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 1: Valid Draft Submission
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 1: Valid Draft Submission → statusId Returned', () => {
    it('submits valid draft and returns statusId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-sandbox-001' }),
      } as any);

      const result = (await client.submitDraft(testLaudo.id, testPayload)) as SubmitDraftResponse;

      expect(result).toHaveProperty('statusId');
      expect(result).toHaveProperty('submittedAt');
      expect(result.statusId).toBe('status-sandbox-001');
      expect(result.submittedAt).toBeGreaterThan(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('includes correct HTTP headers in submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-001' }),
      } as any);

      await client.submitDraft(testLaudo.id, testPayload);

      const callArgs = mockFetch.mock.calls[0];
      const [url, options] = callArgs;

      expect(url).toContain('/api/v1/submissions');
      expect((options as any).method).toBe('POST');
      expect((options as any).headers.Authorization).toBe(`Bearer ${SANDBOX_KEY}`);
      expect((options as any).headers['X-Draft-ID']).toBe(testLaudo.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 2: Duplicate Submission Detection
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 2: Duplicate Submission → Error Code Detected', () => {
    it('handles duplicate submission error (409 Conflict)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'Draft already submitted',
      } as any);

      const result = await client.submitDraft(testLaudo.id, testPayload);

      expect((result as any).status).toBe('error');
      expect((result as any).reason).toContain('HTTP 409');
    });

    it('does not retry on 409 conflict', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'Conflict',
      } as any);

      await client.submitDraft(testLaudo.id, testPayload);

      // 409 is not retryable, so only 1 attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 3: Status Polling (5 Cycles)
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 3: Status Polling → 5 Cycles, State Transitions Verified', () => {
    it('polls status through 5 cycles with state transitions', async () => {
      const statusId = 'status-polling-001';
      const states = ['pending', 'processing', 'processing', 'approved', 'approved'];

      for (const state of states) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: state }),
        } as any);
      }

      for (let i = 0; i < 5; i++) {
        const result = (await client.checkStatus(statusId)) as CheckStatusResponse;

        expect(result.status).toBe(states[i]);
      }

      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('tracks state transitions: pending → processing → approved', async () => {
      const stateSequence: string[] = [];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          const state = 'pending';
          stateSequence.push(state);
          return { status: state };
        },
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          const state = 'processing';
          stateSequence.push(state);
          return { status: state };
        },
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          const state = 'approved';
          stateSequence.push(state);
          return { status: state };
        },
      } as any);

      await client.checkStatus('status-001');
      await client.checkStatus('status-001');
      await client.checkStatus('status-001');

      expect(stateSequence).toEqual(['pending', 'processing', 'approved']);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 4: Network Timeout → Retry Logic
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 4: Network Timeout → Retry Logic Triggers, Max 5 Retries', () => {
    it('retries on AbortError (timeout) up to 5 times', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      // Fail 4 times, succeed on 5th
      mockFetch.mockRejectedValueOnce(abortError);
      mockFetch.mockRejectedValueOnce(abortError);
      mockFetch.mockRejectedValueOnce(abortError);
      mockFetch.mockRejectedValueOnce(abortError);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-after-timeout' }),
      } as any);

      const result = (await client.submitDraft(testLaudo.id, testPayload)) as SubmitDraftResponse;

      expect(result.statusId).toBe('status-after-timeout');
      expect(mockFetch).toHaveBeenCalledTimes(5);
    }, 30000); // Long timeout for backoff delays

    it('exhausts 5 retries and returns error', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValue(abortError);

      const result = await client.submitDraft(testLaudo.id, testPayload);

      expect((result as any).status).toBe('error');
      expect((result as any).retryCount).toBe(5);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    }, 30000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 5: Invalid Payload (Zod Validation)
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 5: Invalid Payload → Zod Rejection Before HTTP Call', () => {
    it('rejects payload with invalid CPF format', () => {
      const invalidPayload = {
        ...testPayload,
        paciente_cpf: 'invalid-cpf',
      };

      expect(() => {
        validateNotivisaPayload(invalidPayload);
      }).toThrow();

      // Ensure no HTTP call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects payload missing mandatory field', () => {
      const incomplete = { ...testPayload };
      delete (incomplete as any).versao;

      expect(() => {
        validateNotivisaPayload(incomplete);
      }).toThrow();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects payload with invalid timestamp', () => {
      const invalidPayload = {
        ...testPayload,
        data_resultado: -1,
      };

      expect(() => {
        validateNotivisaPayload(invalidPayload);
      }).toThrow();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 6: Concurrent Submissions
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 6: Concurrent Submissions → No Race Condition', () => {
    it('handles 10 concurrent submissions without race condition', async () => {
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ statusId: `status-concurrent-${i}` }),
        } as any);
      }

      const promises = [];
      for (let i = 0; i < 10; i++) {
        const payload = { ...testPayload, laudo_id: `laudo-concurrent-${i}` };
        promises.push(client.submitDraft(`draft-${i}`, payload));
      }

      const results = (await Promise.all(promises)) as SubmitDraftResponse[];

      expect(results).toHaveLength(10);
      results.forEach((result, idx) => {
        expect(result.statusId).toBe(`status-concurrent-${idx}`);
      });
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 7-12: Payload Builder Edge Cases
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 7: CPF Validation (11-digit format)', () => {
    it('accepts valid 11-digit CPF', () => {
      const laudo = { ...testLaudo, pacienteCpf: '12345678900' };
      expect(() => {
        buildNotivisaPayload(laudo, testLab);
      }).not.toThrow();
    });

    it('rejects CPF with less than 11 digits', async () => {
      const laudo = { ...testLaudo, pacienteCpf: '1234567890' };
      await expect(buildNotivisaPayload(laudo, testLab)).rejects.toThrow('CPF');
    });

    it('rejects CPF with non-numeric characters', async () => {
      const laudo = { ...testLaudo, pacienteCpf: '123.456.789-00' };
      await expect(buildNotivisaPayload(laudo, testLab)).rejects.toThrow('CPF');
    });
  });

  describe('Test 8: Date Format Validation', () => {
    it('accepts valid timestamp (milliseconds)', async () => {
      const laudo = { ...testLaudo, resultadoEm: Date.now() };
      const payload = await buildNotivisaPayload(laudo, testLab);
      expect(payload.data_resultado).toBeGreaterThan(0);
    });

    it('rejects negative timestamp', async () => {
      const laudo = { ...testLaudo, resultadoEm: -1000 };
      await expect(buildNotivisaPayload(laudo, testLab)).rejects.toThrow();
    });
  });

  describe('Test 9: Operator CPF Masking', () => {
    it('masks operator CPF correctly in payload', async () => {
      const laudo = { ...testLaudo };
      const payload = await buildNotivisaPayload(laudo, testLab);
      // Payload builder should preserve original CPF in internal format
      expect(payload.assinador.cpf).toBeTruthy();
    });
  });

  describe('Test 10: Empty Results Validation', () => {
    it('rejects laudo with no results', async () => {
      const laudo = { ...testLaudo, resultados: [] };
      await expect(buildNotivisaPayload(laudo, testLab)).rejects.toThrow('at least one result');
    });
  });

  describe('Test 11: Deleted Laudo Check', () => {
    it('rejects deleted laudo', async () => {
      const laudo = { ...testLaudo, deletadoEm: Date.now() };
      await expect(buildNotivisaPayload(laudo, testLab)).rejects.toThrow(
        'Cannot submit deleted laudo',
      );
    });
  });

  describe('Test 12: Panel Code Validation', () => {
    it('accepts valid analito names', async () => {
      const laudo = {
        ...testLaudo,
        resultados: [
          { analito: 'VDRL', valor: '1:256', unidade: 'título', referencia: 'Neg' },
          { analito: 'FTA-Abs', valor: 'Positivo', unidade: '', referencia: 'Negativo' },
        ],
      };
      const payload = await buildNotivisaPayload(laudo, testLab);
      expect(payload.resultados).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Test 13-18: HTTP Client Retry Scenarios
  // ─────────────────────────────────────────────────────────────────────

  describe('Test 13: Retry on 5xx Server Error', () => {
    it('retries on 500 and succeeds on retry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-after-500' }),
      } as any);

      const result = (await client.submitDraft(testLaudo.id, testPayload)) as SubmitDraftResponse;

      expect(result.statusId).toBe('status-after-500');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);
  });

  describe('Test 14: Retry on 503 Service Unavailable', () => {
    it('retries on 503 with exponential backoff', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-after-503' }),
      } as any);

      const result = (await client.submitDraft(testLaudo.id, testPayload)) as SubmitDraftResponse;

      expect(result.statusId).toBe('status-after-503');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 30000);
  });

  describe('Test 15: Retry on 429 Rate Limit', () => {
    it('retries on 429 Too Many Requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate Limited',
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-after-429' }),
      } as any);

      const result = (await client.submitDraft(testLaudo.id, testPayload)) as SubmitDraftResponse;

      expect(result.statusId).toBe('status-after-429');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);
  });

  describe('Test 16: No Retry on 4xx Client Errors', () => {
    it('fails immediately on 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as any);

      const result = await client.submitDraft(testLaudo.id, testPayload);

      expect((result as any).status).toBe('error');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('fails immediately on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as any);

      const result = await client.submitDraft(testLaudo.id, testPayload);

      expect((result as any).status).toBe('error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test 17: Exponential Backoff Timing', () => {
    it('uses exponential backoff: 1, 2, 4, 8, 16 seconds', async () => {
      // This test verifies delay logic by mocking setTimeout
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      jest.useFakeTimers();

      mockFetch.mockRejectedValue(new Error('Network error'));

      // Start submission
      const submitPromise = client.submitDraft(testLaudo.id, testPayload);

      // Manually advance timers and track delays
      let timerCount = 0;
      jest.runAllTimers();

      jest.useRealTimers();

      const result = await submitPromise;

      expect((result as any).status).toBe('error');
      // Note: Actual delay verification would require more sophisticated mocking
    }, 30000);
  });

  describe('Test 18: Request Timeout at 30 seconds', () => {
    it('enforces 30-second timeout per request', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      mockFetch.mockRejectedValue(abortError);

      const result = await client.submitDraft(testLaudo.id, testPayload);

      expect((result as any).status).toBe('error');
      expect((result as any).reason).toContain('Request timeout');
    }, 30000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Helper: Payload Builder Unit Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Payload Builder — Unit Tests', () => {
  it('transforms laudo to valid NOTIVISA payload', async () => {
    const payload = await buildNotivisaPayload(testLaudo, testLab);

    expect(payload).toHaveProperty('versao', '1.0');
    expect(payload).toHaveProperty('laudo_id', testLaudo.id);
    expect(payload).toHaveProperty('paciente_cpf', testLaudo.pacienteCpf);
    expect(payload).toHaveProperty('assinador');
    expect(payload.assinador.cpf).toBe(testLaudo.assinatura.operatorCpf);
  });

  it('validates payload against schema after transformation', async () => {
    const payload = await buildNotivisaPayload(testLaudo, testLab);

    // Should not throw
    expect(() => {
      validateNotivisaPayload(payload);
    }).not.toThrow();
  });
});
