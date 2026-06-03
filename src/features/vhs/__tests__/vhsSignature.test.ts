import { describe, it, expect } from 'vitest';
import { generateVHSSignature, type VHSSignaturePayload } from '../hooks/useVHSSignature';

const basePayload: VHSSignaturePayload = {
  amostra: 'VHS-2026-001',
  valor: 15,
  responsavel: 'user-test-001',
  leituraEm: '2026-06-03T10:30:00.000Z',
  met: 'westergren',
};

describe('generateVHSSignature', () => {
  // ── 1. Canonical order ──────────────────────────────────────────────────
  it('canonical order: different key order produces same hash', async () => {
    const hashA = await generateVHSSignature(basePayload);
    const hashB = await generateVHSSignature({
      leituraEm: basePayload.leituraEm,
      met: basePayload.met,
      responsavel: basePayload.responsavel,
      valor: basePayload.valor,
      amostra: basePayload.amostra,
    });
    expect(hashA).toBe(hashB);
  });

  // ── 2. Determinism ──────────────────────────────────────────────────────
  it('determinism: same payload 1000x produces same hash', async () => {
    const hash0 = await generateVHSSignature(basePayload);
    for (let i = 0; i < 1000; i++) {
      const hash = await generateVHSSignature(basePayload);
      expect(hash).toBe(hash0);
    }
  });

  // ── 3. Different valor → different hash ─────────────────────────────────
  it('different valor -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({ ...basePayload, valor: 99 });
    expect(hashDiff).not.toBe(hashBase);
  });

  // ── 4. Different responsavel → different hash ───────────────────────────
  it('different responsavel -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({
      ...basePayload,
      responsavel: 'user-diff-999',
    });
    expect(hashDiff).not.toBe(hashBase);
  });

  // ── 5. Different leituraEm → different hash ─────────────────────────────
  it('different leituraEm -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({
      ...basePayload,
      leituraEm: '2026-06-04T14:00:00.000Z',
    });
    expect(hashDiff).not.toBe(hashBase);
  });

  // ── 6. Different metodo → different hash ────────────────────────────────
  it('different metodo -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({
      ...basePayload,
      met: 'automatizado',
    });
    expect(hashDiff).not.toBe(hashBase);
  });

  // ── 7. Hex length = 64 ──────────────────────────────────────────────────
  it('hex length: hash is always 64 hex chars', async () => {
    const hash = await generateVHSSignature(basePayload);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  // ── 8. Empty fields work ────────────────────────────────────────────────
  it('empty fields still produce a valid hash', async () => {
    const payloadEmpty: VHSSignaturePayload = {
      amostra: '',
      valor: 0,
      responsavel: '',
      leituraEm: '',
      met: 'westergren',
    };
    const hash = await generateVHSSignature(payloadEmpty);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  // ── 9. westergren vs automatizado ───────────────────────────────────────
  it('westergren vs automatizado: different methods produce different hashes', async () => {
    const hashW = await generateVHSSignature({ ...basePayload, met: 'westergren' });
    const hashA = await generateVHSSignature({ ...basePayload, met: 'automatizado' });
    expect(hashW).not.toBe(hashA);
  });

  // ── 10. ISO date format ─────────────────────────────────────────────────
  it('ISO date format: different ISO strings for same instant produce different hashes', async () => {
    const hashT1 = await generateVHSSignature({
      ...basePayload,
      leituraEm: '2026-06-03T10:30:00.000Z',
    });
    const hashT2 = await generateVHSSignature({
      ...basePayload,
      leituraEm: '2026-06-03T10:30:00.001Z',
    });
    expect(hashT1).not.toBe(hashT2);
  });
});
