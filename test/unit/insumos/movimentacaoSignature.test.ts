import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import {
  canonicalMovimentacao,
  computeMovimentacaoSignature,
  INSUMO_CHAIN_GENESIS_HASH,
  INSUMO_CHAIN_GENESIS_SEED,
} from '../../../src/features/insumos/utils/movimentacaoSignature';

const basePayload = {
  movId: '11111111-1111-4111-8111-111111111111',
  insumoId: 'ins-abc',
  tipo: 'abertura' as const,
  operadorId: 'uid-42',
  operadorName: 'Vivian',
  clientTimestamp: '2026-04-20T14:30:00.000Z',
};

describe('canonicalMovimentacao', () => {
  it('produz o mesmo string para os mesmos campos independente da ordem no objeto passado', () => {
    const reordered = {
      clientTimestamp: basePayload.clientTimestamp,
      operadorName: basePayload.operadorName,
      operadorId: basePayload.operadorId,
      tipo: basePayload.tipo,
      insumoId: basePayload.insumoId,
      movId: basePayload.movId,
    };
    expect(canonicalMovimentacao(basePayload)).toBe(canonicalMovimentacao(reordered));
  });

  it('inclui motivo quando fornecido e é determinístico', () => {
    const withMotivo = { ...basePayload, motivo: 'contaminação' };
    const c1 = canonicalMovimentacao(withMotivo);
    const c2 = canonicalMovimentacao(withMotivo);
    expect(c1).toBe(c2);
    expect(c1).toContain('contaminação');
  });

  it('omite motivo quando undefined — evita chave null na canonical', () => {
    const c = canonicalMovimentacao(basePayload);
    expect(c).not.toContain('motivo');
  });

  it('canonical diverge quando motivo presente vs. ausente', () => {
    const withMotivo = { ...basePayload, motivo: 'contaminação' };
    expect(canonicalMovimentacao(withMotivo)).not.toBe(canonicalMovimentacao(basePayload));
  });
});

describe('computeMovimentacaoSignature', () => {
  it('retorna SHA-256 hex de 64 caracteres', async () => {
    const sig = await computeMovimentacaoSignature(basePayload);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('é determinístico — mesmo input produz mesma saída', async () => {
    const a = await computeMovimentacaoSignature(basePayload);
    const b = await computeMovimentacaoSignature(basePayload);
    expect(a).toBe(b);
  });

  it('muda quando qualquer campo muda — property-based sobre campos sensíveis', async () => {
    const base = await computeMovimentacaoSignature(basePayload);
    const diffOperador = await computeMovimentacaoSignature({
      ...basePayload,
      operadorId: 'uid-outro',
    });
    const diffTipo = await computeMovimentacaoSignature({
      ...basePayload,
      tipo: 'descarte',
    });
    const diffTimestamp = await computeMovimentacaoSignature({
      ...basePayload,
      clientTimestamp: '2026-04-20T14:30:00.001Z',
    });
    const diffMovId = await computeMovimentacaoSignature({
      ...basePayload,
      movId: '22222222-2222-4222-8222-222222222222',
    });
    expect(diffOperador).not.toBe(base);
    expect(diffTipo).not.toBe(base);
    expect(diffTimestamp).not.toBe(base);
    expect(diffMovId).not.toBe(base);
  });

  it('confirma SHA-256 comparando com Node crypto (oracle test)', async () => {
    const canonical = canonicalMovimentacao(basePayload);
    const nodeHash = crypto.createHash('sha256').update(canonical).digest('hex');
    const webHash = await computeMovimentacaoSignature(basePayload);
    expect(webHash).toBe(nodeHash);
  });
});

describe('INSUMO_CHAIN_GENESIS_HASH', () => {
  it('bate com SHA-256 do seed — invariante compartilhada com a Cloud Function', () => {
    const recomputed = crypto
      .createHash('sha256')
      .update(INSUMO_CHAIN_GENESIS_SEED)
      .digest('hex');
    expect(INSUMO_CHAIN_GENESIS_HASH).toBe(recomputed);
    expect(INSUMO_CHAIN_GENESIS_HASH).toMatch(/^[0-9a-f]{64}$/);
  });
});
