import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import {
  canonicalFR10,
  computeFR10Hash,
} from '../../../src/features/insumos/services/fr10ExportService';
import type { FR10Payload, FR10Row } from '../../../src/features/insumos/services/fr10ExportService';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseRow = (overrides: Partial<FR10Row> = {}): FR10Row => ({
  insumoId: 'insumo-A',
  nomeComercial: 'Diluente Yumizen',
  fabricante: 'HORIBA',
  lote: 'L001',
  validade: new Date('2026-12-31T00:00:00Z'),
  aberturaMovId: 'mov-1',
  dataAbertura: new Date('2026-04-01T08:00:00Z'),
  operadorAbertura: 'Vivian',
  ...overrides,
});

const basePayload = (overrides: Partial<FR10Payload> = {}): FR10Payload => ({
  labId: 'lab-xyz',
  labName: 'LabClin Rio Pomba',
  labCnpj: '12.345.678/0001-90',
  equipamento: 'Yumizen H550',
  modulo: 'hematologia',
  periodoInicio: new Date('2026-04-01T00:00:00Z'),
  periodoFim: new Date('2026-04-30T23:59:59Z'),
  rows: [baseRow()],
  generatedAt: new Date('2026-04-20T14:00:00Z'),
  generatedBy: { uid: 'uid-42', displayName: 'Vivian' },
  ...overrides,
});

// ─── canonicalFR10 ───────────────────────────────────────────────────────────

describe('canonicalFR10', () => {
  it('é determinístico — mesmo payload gera mesmo canonical', () => {
    const p = basePayload();
    expect(canonicalFR10(p)).toBe(canonicalFR10(p));
  });

  it('diverge quando qualquer campo de identidade muda', () => {
    const base = canonicalFR10(basePayload());
    expect(canonicalFR10(basePayload({ labId: 'outro' }))).not.toBe(base);
    expect(canonicalFR10(basePayload({ equipamento: 'outro' }))).not.toBe(base);
    expect(canonicalFR10(basePayload({ modulo: 'coagulacao' }))).not.toBe(base);
    expect(canonicalFR10(basePayload({ periodoFim: new Date('2026-05-01') }))).not.toBe(base);
  });

  it('diverge quando qualquer campo de linha muda', () => {
    const base = canonicalFR10(basePayload());
    expect(
      canonicalFR10(basePayload({ rows: [baseRow({ lote: 'L999' })] })),
    ).not.toBe(base);
    expect(
      canonicalFR10(basePayload({ rows: [baseRow({ operadorAbertura: 'outro' })] })),
    ).not.toBe(base);
    expect(
      canonicalFR10(basePayload({ rows: [baseRow({ dataAbertura: new Date('2026-04-02') })] })),
    ).not.toBe(base);
  });

  it('inclui término quando presente e omite quando ausente', () => {
    const semTermino = canonicalFR10(basePayload({ rows: [baseRow()] }));
    const comTermino = canonicalFR10(
      basePayload({
        rows: [
          baseRow({
            terminoMovId: 'mov-2',
            dataTermino: new Date('2026-04-25T18:00:00Z'),
            operadorTermino: 'Rodrigo',
            motivoTermino: 'fechamento',
          }),
        ],
      }),
    );
    expect(semTermino).not.toBe(comTermino);
    expect(comTermino).toContain('terminoMovId');
    expect(semTermino).not.toContain('terminoMovId');
  });

  it('CNPJ ausente vira string vazia — sem null no canonical', () => {
    const canonical = canonicalFR10(basePayload({ labCnpj: undefined }));
    expect(canonical).toContain('"cnpj":""');
  });

  it('datas são ISO8601 UTC (zero depending de timezone local)', () => {
    const canonical = canonicalFR10(basePayload());
    expect(canonical).toContain('2026-04-01T00:00:00.000Z'); // periodoInicio
    expect(canonical).toContain('2026-04-30T23:59:59.000Z'); // periodoFim
    expect(canonical).toContain('2026-04-20T14:00:00.000Z'); // generatedAt
  });
});

// ─── computeFR10Hash ─────────────────────────────────────────────────────────

describe('computeFR10Hash', () => {
  it('retorna SHA-256 hex de 64 caracteres', async () => {
    const hash = await computeFR10Hash(basePayload());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('é determinístico', async () => {
    const p = basePayload();
    const a = await computeFR10Hash(p);
    const b = await computeFR10Hash(p);
    expect(a).toBe(b);
  });

  it('bate com Node crypto sobre o canonical (oracle test)', async () => {
    const p = basePayload();
    const canonical = canonicalFR10(p);
    const nodeHash = crypto.createHash('sha256').update(canonical).digest('hex');
    const webHash = await computeFR10Hash(p);
    expect(webHash).toBe(nodeHash);
  });

  it('muda quando qualquer linha muda — sensibilidade a tampering', async () => {
    const base = await computeFR10Hash(basePayload());
    const tampered = await computeFR10Hash(
      basePayload({ rows: [baseRow({ lote: 'adulterado' })] }),
    );
    expect(tampered).not.toBe(base);
  });

  it('muda quando ordem das linhas muda — FR-10 ordem importa', async () => {
    const p1 = basePayload({
      rows: [
        baseRow({ insumoId: 'A', aberturaMovId: 'mA' }),
        baseRow({ insumoId: 'B', aberturaMovId: 'mB' }),
      ],
    });
    const p2 = basePayload({
      rows: [
        baseRow({ insumoId: 'B', aberturaMovId: 'mB' }),
        baseRow({ insumoId: 'A', aberturaMovId: 'mA' }),
      ],
    });
    expect(await computeFR10Hash(p1)).not.toBe(await computeFR10Hash(p2));
  });
});
