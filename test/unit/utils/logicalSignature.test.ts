import { describe, it, expect } from 'vitest';
import { generateLogicalSignature, verifySignature } from '../../../src/utils/logicalSignature';

// ─── Mock Firestore Timestamp ─────────────────────────────────────────────────

const makeTimestamp = (seconds: number) => ({
  seconds,
  nanoseconds: 0,
  toDate:   () => new Date(seconds * 1000),
  toMillis: () => seconds * 1000,
  isEqual:  () => false,
  toJSON:   () => ({ seconds, nanoseconds: 0 }),
  valueOf:  () => seconds * 1000,
} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

const TS      = makeTimestamp(1710000000);
const TS_NEXT = makeTimestamp(1710000001);

const BASE_OP   = 'user-1234';
const BASE_DATA: Record<string, number> = { WBC: 7.5, RBC: 4.8, HGB: 14.2 };

// ─── generateLogicalSignature ─────────────────────────────────────────────────

describe('generateLogicalSignature', () => {

  it('retorna string hex de 64 caracteres (SHA-256)', async () => {
    const sig = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('é determinística — mesmo input gera mesma assinatura', async () => {
    const [s1, s2] = await Promise.all([
      generateLogicalSignature(BASE_OP, TS, BASE_DATA),
      generateLogicalSignature(BASE_OP, TS, BASE_DATA),
    ]);
    expect(s1).toBe(s2);
  });

  it('muda ao alterar operatorId', async () => {
    const s1 = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const s2 = await generateLogicalSignature('user-9999', TS, BASE_DATA);
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar timestamp (toMillis)', async () => {
    const s1 = await generateLogicalSignature(BASE_OP, TS,      BASE_DATA);
    const s2 = await generateLogicalSignature(BASE_OP, TS_NEXT, BASE_DATA);
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar qualquer valor em confirmedData', async () => {
    const s1 = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const s2 = await generateLogicalSignature(BASE_OP, TS, { ...BASE_DATA, WBC: 8.0 });
    expect(s1).not.toBe(s2);
  });

  it('muda ao adicionar um novo analito a confirmedData', async () => {
    const s1 = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const s2 = await generateLogicalSignature(BASE_OP, TS, { ...BASE_DATA, PLT: 250 });
    expect(s1).not.toBe(s2);
  });

  // ── sortedStringify — invariância da ordem de chaves ─────────────────────────

  it('sortedStringify — chaves em ordem diferente produzem a mesma assinatura', async () => {
    // Inserção em ordens diferentes → deve gerar o mesmo hash
    const dataABC: Record<string, number> = { RBC: 4.8, WBC: 7.5, HGB: 14.2 };
    const dataCBA: Record<string, number> = { HGB: 14.2, RBC: 4.8, WBC: 7.5 };
    const s1 = await generateLogicalSignature(BASE_OP, TS, dataABC);
    const s2 = await generateLogicalSignature(BASE_OP, TS, dataCBA);
    expect(s1).toBe(s2);
  });

  it('sortedStringify — objetos com chaves idênticas mas valores diferentes diferem', async () => {
    const d1: Record<string, number> = { WBC: 7.5, RBC: 4.8 };
    const d2: Record<string, number> = { WBC: 4.8, RBC: 7.5 }; // valores trocados
    const s1 = await generateLogicalSignature(BASE_OP, TS, d1);
    const s2 = await generateLogicalSignature(BASE_OP, TS, d2);
    expect(s1).not.toBe(s2);
  });

  it('cada campo contribui independentemente — nenhum é ignorado', async () => {
    const base = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const alternatives: Array<Parameters<typeof generateLogicalSignature>> = [
      ['other-op',  TS,      BASE_DATA],
      [BASE_OP,     TS_NEXT, BASE_DATA],
      [BASE_OP,     TS,      { ...BASE_DATA, WBC: 99 }],
    ];
    for (const args of alternatives) {
      const sig = await generateLogicalSignature(...args);
      expect(sig, 'campo alterado deve mudar a assinatura').not.toBe(base);
    }
  });
});

// ─── verifySignature ──────────────────────────────────────────────────────────

describe('verifySignature', () => {

  it('retorna true para assinatura válida (roundtrip)', async () => {
    const sig   = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const valid = await verifySignature(sig, BASE_OP, TS, BASE_DATA);
    expect(valid).toBe(true);
  });

  it('retorna false para assinatura adulterada (1 char alterado)', async () => {
    const sig = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    const tampered = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    expect(await verifySignature(tampered, BASE_OP, TS, BASE_DATA)).toBe(false);
  });

  it('retorna false quando operatorId difere', async () => {
    const sig = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    expect(await verifySignature(sig, 'other-user', TS, BASE_DATA)).toBe(false);
  });

  it('retorna false quando timestamp difere', async () => {
    const sig = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    expect(await verifySignature(sig, BASE_OP, TS_NEXT, BASE_DATA)).toBe(false);
  });

  it('retorna false quando confirmedData difere', async () => {
    const sig = await generateLogicalSignature(BASE_OP, TS, BASE_DATA);
    expect(await verifySignature(sig, BASE_OP, TS, { ...BASE_DATA, WBC: 99 })).toBe(false);
  });

  it('retorna false para string vazia', async () => {
    expect(await verifySignature('', BASE_OP, TS, BASE_DATA)).toBe(false);
  });

  it('retorna false para hash completamente diferente', async () => {
    const fake = '0'.repeat(64);
    expect(await verifySignature(fake, BASE_OP, TS, BASE_DATA)).toBe(false);
  });
});
