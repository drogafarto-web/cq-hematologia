/**
 * Tests para serialização/deserialização de Run no FirebaseService.
 *
 * Testa o comportamento crítico de campos opcionais (sampleId, manualOverride)
 * que causavam "Erro inesperado" quando undefined era passado ao Firestore.
 *
 * As funções serializeLot/serializeRun/deserializeRun são privadas ao módulo,
 * então testamos o contrato via objetos construídos diretamente — simulando
 * exatamente o que o service faz antes de chamar writeBatch.set().
 */
import { describe, it, expect } from 'vitest';
import type { Run, AnalyteResult, WestgardViolation } from '../../../src/types';

// ─── Helpers que replicam a lógica de serialização ────────────────────────────
// Copiados do firebaseService para testar em isolamento, sem inicializar Firebase.

function serializeRunContract(run: Run): Record<string, unknown> {
  const { id: _id, timestamp, results, sampleId, manualOverride, ...rest } = run;
  return {
    ...rest,
    ...(sampleId      && { sampleId }),
    ...(manualOverride && { manualOverride }),
    timestamp: timestamp.getTime(), // simulamos Timestamp.fromDate
    results: results.map((r) => ({
      ...r,
      timestamp: r.timestamp.getTime(),
      violations: r.violations ?? [],
    })),
  };
}

function deserializeRunContract(raw: Record<string, unknown>): Partial<Run> {
  const d = raw as {
    lotId: string; labId: string; imageUrl: string; status: string;
    createdBy: string; timestamp: number; results: unknown[];
    sampleId?: string; manualOverride?: boolean;
  };
  return {
    lotId:     d.lotId,
    labId:     d.labId,
    imageUrl:  d.imageUrl,
    createdBy: d.createdBy,
    ...(d.sampleId       && { sampleId:       d.sampleId }),
    ...(d.manualOverride && { manualOverride: d.manualOverride }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RESULT: AnalyteResult = {
  id:         'res-1',
  runId:      'run-1',
  analyteId:  'WBC',
  value:      5.0,
  confidence: 1.0,
  reasoning:  'extracted',
  timestamp:  new Date('2026-04-16T10:00:00Z'),
  violations: [] as WestgardViolation[],
};

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id:        'run-1',
    lotId:     'lot-1',
    labId:     'lab-1',
    imageUrl:  '',
    status:    'Aprovada',
    createdBy: 'user-1',
    timestamp: new Date('2026-04-16T10:00:00Z'),
    results:   [BASE_RESULT],
    ...overrides,
  };
}

// ─── serializeRun — campos opcionais ─────────────────────────────────────────

describe('serializeRun — campos opcionais', () => {

  it('NÃO inclui sampleId quando undefined (evita erro Firestore)', () => {
    const run = makeRun({ sampleId: undefined });
    const out = serializeRunContract(run);
    expect(out).not.toHaveProperty('sampleId');
  });

  it('NÃO inclui manualOverride quando undefined (evita erro Firestore)', () => {
    const run = makeRun({ manualOverride: undefined });
    const out = serializeRunContract(run);
    expect(out).not.toHaveProperty('manualOverride');
  });

  it('NÃO inclui manualOverride quando false (falsy → omitido)', () => {
    const run = makeRun({ manualOverride: false });
    const out = serializeRunContract(run);
    expect(out).not.toHaveProperty('manualOverride');
  });

  it('INCLUI sampleId quando presente', () => {
    const run = makeRun({ sampleId: 'HHI1372' });
    const out = serializeRunContract(run);
    expect(out.sampleId).toBe('HHI1372');
  });

  it('INCLUI manualOverride quando true', () => {
    const run = makeRun({ manualOverride: true });
    const out = serializeRunContract(run);
    expect(out.manualOverride).toBe(true);
  });

  it('NÃO inclui sampleId quando string vazia', () => {
    const run = makeRun({ sampleId: '' });
    const out = serializeRunContract(run);
    expect(out).not.toHaveProperty('sampleId');
  });

  it('serializa violations como array vazio quando ausente', () => {
    const resultSemViolations: AnalyteResult = { ...BASE_RESULT, violations: undefined as unknown as WestgardViolation[] };
    const run = makeRun({ results: [resultSemViolations] });
    const out = serializeRunContract(run) as { results: Array<{ violations: unknown }> };
    expect(out.results[0].violations).toEqual([]);
  });

  it('campos obrigatórios sempre presentes', () => {
    const run = makeRun();
    const out = serializeRunContract(run);
    expect(out).toHaveProperty('lotId', 'lot-1');
    expect(out).toHaveProperty('labId', 'lab-1');
    expect(out).toHaveProperty('imageUrl', '');
    expect(out).toHaveProperty('status', 'Aprovada');
    expect(out).toHaveProperty('createdBy', 'user-1');
    expect(out).toHaveProperty('timestamp');
    expect(out).toHaveProperty('results');
  });
});

// ─── deserializeRun — campos opcionais ───────────────────────────────────────

describe('deserializeRun — campos opcionais', () => {

  it('NÃO inclui sampleId quando campo ausente no Firestore', () => {
    const raw = { lotId: 'l', labId: 'l', imageUrl: '', status: 'Aprovada', createdBy: 'u', timestamp: 0, results: [] };
    const out = deserializeRunContract(raw);
    expect(out).not.toHaveProperty('sampleId');
  });

  it('NÃO inclui manualOverride quando campo ausente no Firestore', () => {
    const raw = { lotId: 'l', labId: 'l', imageUrl: '', status: 'Aprovada', createdBy: 'u', timestamp: 0, results: [] };
    const out = deserializeRunContract(raw);
    expect(out).not.toHaveProperty('manualOverride');
  });

  it('INCLUI sampleId quando presente no Firestore', () => {
    const raw = { lotId: 'l', labId: 'l', imageUrl: '', status: 'Aprovada', createdBy: 'u', timestamp: 0, results: [], sampleId: 'HHI1372' };
    const out = deserializeRunContract(raw);
    expect(out.sampleId).toBe('HHI1372');
  });

  it('INCLUI manualOverride:true quando presente no Firestore', () => {
    const raw = { lotId: 'l', labId: 'l', imageUrl: '', status: 'Aprovada', createdBy: 'u', timestamp: 0, results: [], manualOverride: true };
    const out = deserializeRunContract(raw);
    expect(out.manualOverride).toBe(true);
  });

  it('round-trip: run com sampleId serializado e deserializado mantém sampleId', () => {
    const run = makeRun({ sampleId: 'HHI1372' });
    const serialized = serializeRunContract(run) as Record<string, unknown>;
    // simulamos Firestore round-trip
    const serializedWithTimestamp = { ...serialized, timestamp: 0, results: [] };
    const deserialized = deserializeRunContract(serializedWithTimestamp);
    expect(deserialized.sampleId).toBe('HHI1372');
  });

  it('round-trip: run sem sampleId não ganha sampleId após round-trip', () => {
    const run = makeRun({ sampleId: undefined });
    const serialized = serializeRunContract(run);
    const serializedWithTimestamp = { ...serialized, timestamp: 0, results: [] };
    const deserialized = deserializeRunContract(serializedWithTimestamp);
    expect(deserialized).not.toHaveProperty('sampleId');
  });
});

// ─── confirmRun — objeto Run construído sem undefined ────────────────────────

describe('construção do objeto Run em confirmRun', () => {

  it('manualOverride=false → campo omitido com spread condicional', () => {
    const manualOverride = false;
    const run = {
      id: 'run-1',
      ...(manualOverride && { manualOverride: true }),
    };
    expect(run).not.toHaveProperty('manualOverride');
  });

  it('manualOverride=true → campo incluído', () => {
    const manualOverride = true;
    const run = {
      id: 'run-1',
      ...(manualOverride && { manualOverride: true }),
    };
    expect(run.manualOverride).toBe(true);
  });

  it('sampleId=undefined → campo omitido com spread condicional', () => {
    const sampleId: string | undefined = undefined;
    const run = {
      id: 'run-1',
      ...(sampleId && { sampleId }),
    };
    expect(run).not.toHaveProperty('sampleId');
  });

  it('sampleId="HHI1372" → campo incluído', () => {
    const sampleId: string | undefined = 'HHI1372';
    const run = {
      id: 'run-1',
      ...(sampleId && { sampleId }),
    };
    expect((run as { sampleId?: string }).sampleId).toBe('HHI1372');
  });
});
