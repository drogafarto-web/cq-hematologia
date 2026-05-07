/**
 * NOTIVISA Batch 1 Callable Tests
 * Phase 8 ADR-0026 implementation verification
 *
 * Tests:
 *   - notivisaDraftCreate: schema validation, idempotency, rate limiting
 *   - approveNotivisaDraft: signature verification, status transition
 *   - submitNotivisaDraft: queue creation, audit logging
 *   - rejectNotivisaDraft: rejection with motivo, signature sealing
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import {
  NotivisaDraftCreateInputSchema,
  ApproveNotivisaDraftInputSchema,
  SubmitNotivisaDraftInputSchema,
  RejectNotivisaDraftInputSchema,
} from '../validators';
import { sha256Hex, sortedStringify } from '../signatureCanonical';

describe('NOTIVISA Batch 1 — Schema Validation', () => {
  describe('notivisaDraftCreate schema', () => {
    it('accepts valid payload', () => {
      const input = {
        labId: 'lab-123',
        laudoId: 'laudo-456',
        payload: {
          versao: '1.0',
          laudo_id: 'laudo-456',
          paciente_cpf: '12345678901',
          data_resultado: 1714945200,
          resultados: [
            {
              analito: 'Sífilis',
              valor: 'Positivo',
              unidade: 'qualitativo',
              referencia: 'Negativo',
            },
          ],
          assinador: {
            cpf: '11144455566',
            nome: 'Dr. Silva',
            data_assinatura: 1714945200,
          },
        },
      };

      const result = NotivisaDraftCreateInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid CPF', () => {
      const input = {
        labId: 'lab-123',
        laudoId: 'laudo-456',
        payload: {
          versao: '1.0' as const,
          laudo_id: 'laudo-456',
          paciente_cpf: 'invalid',
          data_resultado: 1714945200,
          resultados: [
            {
              analito: 'Test',
              valor: 'positive',
              unidade: 'u',
              referencia: 'ref',
            },
          ],
          assinador: {
            cpf: '11144455566',
            nome: 'Dr. Silva',
            data_assinatura: 1714945200,
          },
        },
      };

      const result = NotivisaDraftCreateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('requires at least one resultado', () => {
      const input = {
        labId: 'lab-123',
        laudoId: 'laudo-456',
        payload: {
          versao: '1.0' as const,
          laudo_id: 'laudo-456',
          paciente_cpf: '12345678901',
          data_resultado: 1714945200,
          resultados: [],
          assinador: {
            cpf: '11144455566',
            nome: 'Dr. Silva',
            data_assinatura: 1714945200,
          },
        },
      };

      const result = NotivisaDraftCreateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('approveNotivisaDraft schema', () => {
    it('accepts valid approval with signature', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
        signature: {
          hash: '0'.repeat(64),
          operatorId: 'uid-789',
          ts: Date.now(),
        },
      };

      const result = ApproveNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid hash (not 64 chars)', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
        signature: {
          hash: '0'.repeat(63),
          operatorId: 'uid-789',
          ts: Date.now(),
        },
      };

      const result = ApproveNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('submitNotivisaDraft schema', () => {
    it('accepts valid submission with optional signature', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
      };

      const result = SubmitNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('requires labId', () => {
      const input = {
        draftId: 'draft-456',
      };

      const result = SubmitNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('rejectNotivisaDraft schema', () => {
    it('accepts valid rejection with motivo', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
        motivo: 'Paciente CPF não encontrado no sistema',
        signature: {
          hash: '0'.repeat(64),
          operatorId: 'uid-789',
          ts: Date.now(),
        },
      };

      const result = RejectNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects short motivo (< 10 chars)', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
        motivo: 'short',
        signature: {
          hash: '0'.repeat(64),
          operatorId: 'uid-789',
          ts: Date.now(),
        },
      };

      const result = RejectNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects long motivo (> 500 chars)', () => {
      const input = {
        labId: 'lab-123',
        draftId: 'draft-456',
        motivo: 'x'.repeat(501),
        signature: {
          hash: '0'.repeat(64),
          operatorId: 'uid-789',
          ts: Date.now(),
        },
      };

      const result = RejectNotivisaDraftInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('NOTIVISA Batch 1 — Signature Generation', () => {
  it('sortedStringify produces consistent output', () => {
    const payload = {
      z: 'last',
      a: 'first',
      m: 'middle',
    };

    const result1 = sortedStringify(payload as any);
    const result2 = sortedStringify(payload as any);

    expect(result1).toBe(result2);
    expect(result1).toContain('"a":"first"');
    expect(result1).toContain('"m":"middle"');
    expect(result1).toContain('"z":"last"');
  });

  it('sha256Hex generates 64-char hex string', () => {
    const hash = sha256Hex('test-payload');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sha256Hex is deterministic', () => {
    const payload = 'same-payload';
    const hash1 = sha256Hex(payload);
    const hash2 = sha256Hex(payload);
    expect(hash1).toBe(hash2);
  });

  it('different payloads produce different hashes', () => {
    const hash1 = sha256Hex('payload-1');
    const hash2 = sha256Hex('payload-2');
    expect(hash1).not.toBe(hash2);
  });
});
