/**
 * Críticos Signature Contract Tests
 *
 * BLOCKER 1 (Phase 5 audit): all CriticosLogEvento entries must carry a
 * 64-hex HMAC-SHA256 chain hash per ADR-0017 / RDC 978 Art. 128 /
 * Firestore rule `validSignature` (`hash.size() == 64`).
 *
 * These tests exercise the signature primitive used by
 * `buildLogEventoSignature` in `index.ts`. They protect the contract:
 *   - 64 hex chars (SHA-256 hex digest)
 *   - deterministic for the same payload
 *   - chain-aware (different `previousHash` → different output)
 *   - distinct events do not collide
 */
import { describe, it, expect } from '@jest/globals';
import { generateChainHash } from '../../../shared/signature';

const HEX64 = /^[0-9a-f]{64}$/;

describe('Críticos Logical Signature (BLOCKER 1)', () => {
  const basePayload = {
    eventoId: 'evt-001',
    escalacaoId: 'esc-001',
    labId: 'lab-001',
    tipo: 'sms_enviado' as const,
    operadorId: 'user-001',
    tsMs: 1_725_000_000_000,
    detalhes: {
      canal: 'SMS',
      telefone_masked: '+55 98XXXXXXX',
      twilio_sid: 'SM_TEST',
    },
    previousHash: null as string | null,
  };

  it('emits a 64-hex hash (validSignature rule)', () => {
    const hash = generateChainHash(basePayload);
    expect(hash).toMatch(HEX64);
    expect(hash.length).toBe(64);
  });

  it('is deterministic for identical payloads', () => {
    const a = generateChainHash(basePayload);
    const b = generateChainHash({ ...basePayload });
    expect(a).toBe(b);
  });

  it('changes when previousHash changes (chain-aware)', () => {
    const origin = generateChainHash({ ...basePayload, previousHash: null });
    const linked = generateChainHash({
      ...basePayload,
      previousHash: 'a'.repeat(64),
    });
    expect(origin).not.toBe(linked);
    expect(linked).toMatch(HEX64);
  });

  it('produces distinct hashes for distinct events', () => {
    const sms = generateChainHash({ ...basePayload, tipo: 'sms_enviado' });
    const ack = generateChainHash({
      ...basePayload,
      tipo: 'reconhecimento_manual',
      eventoId: 'evt-002',
    });
    const sla = generateChainHash({
      ...basePayload,
      tipo: 'sla_vencido_alerta',
      eventoId: 'evt-003',
      operadorId: 'system',
    });
    const set = new Set([sms, ack, sla]);
    expect(set.size).toBe(3);
    for (const h of set) expect(h).toMatch(HEX64);
  });

  it('rejects empty-string regression (BLOCKER 1 invariant)', () => {
    const hash = generateChainHash(basePayload);
    expect(hash).not.toBe('');
    expect(hash.length).toBe(64);
  });
});
