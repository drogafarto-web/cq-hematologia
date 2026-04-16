import { describe, it, expect } from 'vitest';
import { generateSignature } from '../../../src/features/ciq-imuno/hooks/useCIQSignature';
import type { CIQSignaturePayload } from '../../../src/features/ciq-imuno/hooks/useCIQSignature';

// ─── Payload de referência ────────────────────────────────────────────────────

const BASE_PAYLOAD: CIQSignaturePayload = {
  operatorDocument: 'CRBM-MG 12345',
  lotId:            'lot-abc123',
  testType:         'HIV',
  loteControle:     'L2024-001',
  resultadoObtido:  'R',
  dataRealizacao:   '2026-04-15',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateSignature', () => {

  it('retorna string hex de 64 caracteres (SHA-256)', async () => {
    const sig = await generateSignature(BASE_PAYLOAD);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('é determinística — mesmo payload gera mesma assinatura', async () => {
    const [s1, s2] = await Promise.all([
      generateSignature(BASE_PAYLOAD),
      generateSignature(BASE_PAYLOAD),
    ]);
    expect(s1).toBe(s2);
  });

  it('muda ao alterar operatorDocument', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, operatorDocument: 'CRF-SP 99999' });
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar lotId', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, lotId: 'lot-different' });
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar testType', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, testType: 'HCG' });
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar loteControle', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, loteControle: 'L2024-999' });
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar resultadoObtido', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, resultadoObtido: 'NR' });
    expect(s1).not.toBe(s2);
  });

  it('muda ao alterar dataRealizacao', async () => {
    const s1 = await generateSignature(BASE_PAYLOAD);
    const s2 = await generateSignature({ ...BASE_PAYLOAD, dataRealizacao: '2026-04-16' });
    expect(s1).not.toBe(s2);
  });

  it('canonical JSON — ordem de chaves do input não afeta a assinatura (canonicalização interna)', async () => {
    // A implementação serializa com chaves em ordem fixa (doc, lot, test, ctrl, res, date),
    // independentemente da ordem de inserção das propriedades no objeto de entrada.
    // Se alguém alterar a ordem no JSON canônico, os hashes históricos quebram.
    const sig1 = await generateSignature(BASE_PAYLOAD);

    // Mesmo payload com chaves em ordem de inserção inversa
    const reversed: CIQSignaturePayload = {
      dataRealizacao:   BASE_PAYLOAD.dataRealizacao,
      resultadoObtido:  BASE_PAYLOAD.resultadoObtido,
      loteControle:     BASE_PAYLOAD.loteControle,
      testType:         BASE_PAYLOAD.testType,
      lotId:            BASE_PAYLOAD.lotId,
      operatorDocument: BASE_PAYLOAD.operatorDocument,
    };
    const sig2 = await generateSignature(reversed);

    // Deve produzir o mesmo hash — prova que a ordem do input não importa
    // e que a canonicalização interna é determinística
    expect(sig1).toBe(sig2);
  });

  it('R e NR produzem assinaturas diferentes (sem colisão)', async () => {
    const sigR  = await generateSignature({ ...BASE_PAYLOAD, resultadoObtido: 'R' });
    const sigNR = await generateSignature({ ...BASE_PAYLOAD, resultadoObtido: 'NR' });
    expect(sigR).not.toBe(sigNR);
  });

  it('cada campo contribui independentemente — nenhum é ignorado', async () => {
    const fields: (keyof CIQSignaturePayload)[] = [
      'operatorDocument', 'lotId', 'testType', 'loteControle', 'resultadoObtido', 'dataRealizacao',
    ];
    const base = await generateSignature(BASE_PAYLOAD);

    // Para cada campo, verificar que alterar apenas ele muda a assinatura
    const alternatives: Record<keyof CIQSignaturePayload, CIQSignaturePayload[typeof fields[number]]> = {
      operatorDocument: 'CRF-MG-000',
      lotId:            'lot-OTHER',
      testType:         'HBsAg',
      loteControle:     'L9999-999',
      resultadoObtido:  'NR',
      dataRealizacao:   '2000-01-01',
    };

    for (const field of fields) {
      const modified = { ...BASE_PAYLOAD, [field]: alternatives[field] };
      const sig = await generateSignature(modified as CIQSignaturePayload);
      expect(sig, `campo "${field}" não está sendo incluído no hash`).not.toBe(base);
    }
  });
});
