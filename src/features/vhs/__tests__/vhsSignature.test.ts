import { describe, it, expect } from 'vitest';
import { generateVHSSignature, type VHSSignaturePayload } from '../hooks/useVHSSignature';

const basePayload: VHSSignaturePayload = {
  amostra: 'VHS-2026-001',
  v1: 15,
  op: 'user-test-001',
  met: 'westergren',
  date: '2026-06-03',
};

describe('generateVHSSignature', () => {
  it('canonical order: chaves em ordem diferente produzem mesmo hash', async () => {
    const hashA = await generateVHSSignature({
      amostra: basePayload.amostra,
      v1: basePayload.v1,
      op: basePayload.op,
      met: basePayload.met,
      date: basePayload.date,
    });
    const hashB = await generateVHSSignature({
      date: basePayload.date,
      met: basePayload.met,
      op: basePayload.op,
      v1: basePayload.v1,
      amostra: basePayload.amostra,
    });
    expect(hashA).toBe(hashB);
  });

  it('determinism: mesmo payload 1000x produz mesmo hash', async () => {
    const hash0 = await generateVHSSignature(basePayload);
    for (let i = 0; i < 1000; i++) {
      const hash = await generateVHSSignature(basePayload);
      expect(hash).toBe(hash0);
    }
  });

  it('different value -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({ ...basePayload, v1: 99 });
    expect(hashDiff).not.toBe(hashBase);
  });

  it('different operator -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({ ...basePayload, op: 'user-diff-999' });
    expect(hashDiff).not.toBe(hashBase);
  });

  it('different method -> different hash', async () => {
    const hashBase = await generateVHSSignature(basePayload);
    const hashDiff = await generateVHSSignature({ ...basePayload, met: 'automatizado' });
    expect(hashDiff).not.toBe(hashBase);
  });

  it('hex length: hash sempre tem 64 chars hex', async () => {
    const hash = await generateVHSSignature(basePayload);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('empty string fields still hash', async () => {
    const payloadEmpty: VHSSignaturePayload = {
      amostra: '',
      v1: 0,
      op: '',
      met: 'westergren',
      date: '',
    };
    const hash = await generateVHSSignature(payloadEmpty);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('westergren vs automatizado: metodos diferentes geram hashes diferentes para mesmo valor', async () => {
    const hashWestergren = await generateVHSSignature({ ...basePayload, met: 'westergren' });
    const hashAutomatizado = await generateVHSSignature({ ...basePayload, met: 'automatizado' });
    expect(hashWestergren).not.toBe(hashAutomatizado);
  });
});
