import { describe, it, expect } from 'vitest';
import { computeWestgardCategorico } from '../../../src/features/ciq-imuno/hooks/useCIQWestgard';
import type { CIQImunoRun } from '../../../src/features/ciq-imuno/types/CIQImuno';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockTimestamp = {
  seconds:     1710000000,
  nanoseconds: 0,
  toDate:  () => new Date(1710000000 * 1000),
  toMillis: () => 1710000000 * 1000,
  isEqual: () => false,
  toJSON:  () => ({ seconds: 1710000000, nanoseconds: 0 }),
  valueOf: () => 1710000000 * 1000,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Cria um CIQImunoRun mínimo válido para testes. */
function makeRun(overrides: Partial<CIQImunoRun> = {}): CIQImunoRun {
  return {
    id:               crypto.randomUUID(),
    labId:            'lab-test',
    lotId:            'lot-test',
    operatorId:       'user-1',
    operatorName:     'Operador Teste',
    operatorRole:     'biomedico',
    confirmedAt:      mockTimestamp,
    isEdited:         false,
    status:           'Aprovada',
    version:          1,
    createdBy:        'user-1',
    createdAt:        mockTimestamp,
    imageUrl:         '',
    testType:         'HIV',
    loteControle:     'L2024-001',
    aberturaControle: '2024-01-01',
    validadeControle: '2099-12-31', // futuro — não expira
    loteReagente:     'R2024-001',
    reagenteStatus:   'R',
    aberturaReagente: '2024-01-01',
    validadeReagente: '2099-12-31',
    resultadoEsperado: 'R',
    resultadoObtido:   'R',
    dataRealizacao:    '2024-06-01',
    ...overrides,
  };
}

/** Gera N runs com resultado R (conforme). */
function makeRuns(n: number, overrides: Partial<CIQImunoRun> = {}): CIQImunoRun[] {
  return Array.from({ length: n }, (_, i) => makeRun({
    id: `run-${i + 1}`,
    dataRealizacao: `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    ...overrides,
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeWestgardCategorico', () => {

  // ── Estado inicial ───────────────────────────────────────────────────────────

  describe('sem runs', () => {
    it('retorna sem_dados e nenhum alerta', () => {
      const result = computeWestgardCategorico([]);
      expect(result.lotStatus).toBe('sem_dados');
      expect(result.alerts).toHaveLength(0);
    });
  });

  // ── Lote saudável ────────────────────────────────────────────────────────────

  describe('lote com todos os runs conformes', () => {
    it('retorna valido sem alertas com 1 run R', () => {
      const result = computeWestgardCategorico([makeRun()]);
      expect(result.lotStatus).toBe('valido');
      expect(result.alerts).toHaveLength(0);
    });

    it('retorna valido sem alertas com 15 runs R', () => {
      const result = computeWestgardCategorico(makeRuns(15));
      expect(result.lotStatus).toBe('valido');
      expect(result.alerts).toHaveLength(0);
    });
  });

  // ── Regra 1: Taxa de falha > 10% (mín. 10 runs) ──────────────────────────────

  describe('Regra 1 — taxa_falha_10pct (>10% NR, mín. 10 runs)', () => {
    it('NÃO ativa com < 10 runs mesmo com 100% NR', () => {
      const runs = makeRuns(9, { resultadoObtido: 'NR', status: 'Rejeitada' });
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).not.toContain('taxa_falha_10pct');
    });

    it('NÃO ativa com exatamente 10% NR (10 runs, 1 NR)', () => {
      const runs = [
        ...makeRuns(9),
        makeRun({ id: 'run-nr', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      // 1/10 = 10% — limite estrito (>10%), não ativa
      expect(result.alerts).not.toContain('taxa_falha_10pct');
    });

    it('ATIVA com >10% NR e ≥10 runs (11 runs, 2 NR = 18%)', () => {
      const runs = [
        ...makeRuns(9),
        makeRun({ id: 'nr-1', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr-2', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).toContain('taxa_falha_10pct');
      expect(result.lotStatus).toBe('reprovado');
    });

    it('ATIVA exatamente no threshold: 20 runs, 3 NR = 15%', () => {
      const runs = [
        ...makeRuns(17),
        makeRun({ id: 'nr-1', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr-2', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr-3', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).toContain('taxa_falha_10pct');
    });
  });

  // ── Regra 2: 3+ NR consecutivos ──────────────────────────────────────────────

  describe('Regra 2 — consecutivos_3nr (3+ NR consecutivos)', () => {
    it('NÃO ativa com 2 NR consecutivos', () => {
      const runs = [
        makeRun({ id: 'r1', dataRealizacao: '2024-01-01' }),
        makeRun({ id: 'nr1', dataRealizacao: '2024-01-02', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-01-03', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'r2', dataRealizacao: '2024-01-04' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).not.toContain('consecutivos_3nr');
    });

    it('ATIVA com exatamente 3 NR consecutivos', () => {
      const runs = [
        makeRun({ id: 'r1', dataRealizacao: '2024-01-01' }),
        makeRun({ id: 'nr1', dataRealizacao: '2024-01-02', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-01-03', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr3', dataRealizacao: '2024-01-04', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).toContain('consecutivos_3nr');
      expect(result.lotStatus).toBe('atencao');
    });

    it('ATIVA com 5 NR consecutivos', () => {
      const runs = makeRuns(5, { resultadoObtido: 'NR', status: 'Rejeitada' });
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).toContain('consecutivos_3nr');
    });

    it('NÃO ativa se NR consecutivos são interrompidos por R', () => {
      const runs = [
        makeRun({ id: 'nr1', dataRealizacao: '2024-01-01', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-01-02', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'r1',  dataRealizacao: '2024-01-03' }),  // quebra a sequência
        makeRun({ id: 'nr3', dataRealizacao: '2024-01-04', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr4', dataRealizacao: '2024-01-05', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).not.toContain('consecutivos_3nr');
    });
  });

  // ── Regra 3: 4+ NR nos últimos 10 runs ───────────────────────────────────────

  describe('Regra 3 — consecutivos_4nr (4+ NR na janela de 10)', () => {
    it('NÃO ativa com 3 NR nos últimos 10', () => {
      const runs = [
        ...makeRuns(7),
        makeRun({ id: 'nr1', dataRealizacao: '2024-02-01', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-02-02', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr3', dataRealizacao: '2024-02-03', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).not.toContain('consecutivos_4nr');
    });

    it('ATIVA com exatamente 4 NR nos últimos 10', () => {
      const runs = [
        ...makeRuns(6),
        makeRun({ id: 'nr1', dataRealizacao: '2024-02-01', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-02-02', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr3', dataRealizacao: '2024-02-03', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr4', dataRealizacao: '2024-02-04', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.alerts).toContain('consecutivos_4nr');
    });

    it('janela é limitada aos 10 mais recentes — NR antigos não contam', () => {
      // 5 NR antigos + 11 R recentes → janela de 10 contém apenas os 10 R mais recentes
      // Total: 16 runs. Os 5 NR ficam fora da janela de 10.
      const old = Array.from({ length: 5 }, (_, i) =>
        makeRun({ id: `old-nr-${i}`, dataRealizacao: `2022-0${i + 1}-01`, resultadoObtido: 'NR', status: 'Rejeitada' })
      );
      const recent = Array.from({ length: 11 }, (_, i) =>
        makeRun({ id: `new-r-${i}`, dataRealizacao: `2024-${String(i + 1).padStart(2, '0')}-01` })
      );
      const result = computeWestgardCategorico([...old, ...recent]);
      expect(result.alerts).not.toContain('consecutivos_4nr');
    });
  });

  // ── Regra 4: Lote expirado → reprovado ───────────────────────────────────────

  describe('Regra 4 — lote_expirado (validade < hoje → reprovado)', () => {
    it('ATIVA quando validadeControle é no passado', () => {
      const run = makeRun({ validadeControle: '2020-01-01' });
      const result = computeWestgardCategorico([run]);
      expect(result.alerts).toContain('lote_expirado');
      expect(result.lotStatus).toBe('reprovado');
    });

    it('NÃO ativa quando validadeControle é hoje (data local)', () => {
      // Usa formato local explícito — evita drift de timezone do toISOString() (UTC)
      const now = new Date();
      const y   = now.getFullYear();
      const mo  = String(now.getMonth() + 1).padStart(2, '0');
      const d   = String(now.getDate()).padStart(2, '0');
      const today = `${y}-${mo}-${d}`;
      const run = makeRun({ validadeControle: today });
      const result = computeWestgardCategorico([run]);
      expect(result.alerts).not.toContain('lote_expirado');
    });

    it('reprovado prevalece sobre outros alertas de menor severidade', () => {
      // 3 NR consecutivos (atencao) + lote expirado (reprovado)
      const runs = [
        makeRun({ id: 'nr1', dataRealizacao: '2024-01-01', resultadoObtido: 'NR', validadeControle: '2020-01-01', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', dataRealizacao: '2024-01-02', resultadoObtido: 'NR', validadeControle: '2020-01-01', status: 'Rejeitada' }),
        makeRun({ id: 'nr3', dataRealizacao: '2024-01-03', resultadoObtido: 'NR', validadeControle: '2020-01-01', status: 'Rejeitada' }),
      ];
      const result = computeWestgardCategorico(runs);
      expect(result.lotStatus).toBe('reprovado');
      expect(result.alerts).toContain('lote_expirado');
      expect(result.alerts).toContain('consecutivos_3nr');
    });
  });

  // ── Regra 5: Validade < 30 dias → atencao ────────────────────────────────────

  describe('Regra 5 — validade_30d (vence em < 30 dias → atencao)', () => {
    it('ATIVA quando validade é em 15 dias', () => {
      const near = new Date();
      near.setDate(near.getDate() + 15);
      const run = makeRun({ validadeControle: near.toISOString().split('T')[0] });
      const result = computeWestgardCategorico([run]);
      expect(result.alerts).toContain('validade_30d');
      expect(result.lotStatus).toBe('atencao');
    });

    it('NÃO ativa quando validade é em 30+ dias', () => {
      const far = new Date();
      far.setDate(far.getDate() + 45);
      const run = makeRun({ validadeControle: far.toISOString().split('T')[0] });
      const result = computeWestgardCategorico([run]);
      expect(result.alerts).not.toContain('validade_30d');
    });
  });

  // ── lotStatus ─────────────────────────────────────────────────────────────────

  describe('determinação do lotStatus', () => {
    it('valido — sem alertas', () => {
      expect(computeWestgardCategorico([makeRun()]).lotStatus).toBe('valido');
    });

    it('atencao — apenas alerta de validade próxima', () => {
      const near = new Date();
      near.setDate(near.getDate() + 10);
      const run = makeRun({ validadeControle: near.toISOString().split('T')[0] });
      expect(computeWestgardCategorico([run]).lotStatus).toBe('atencao');
    });

    it('reprovado — taxa_falha_10pct', () => {
      const runs = [
        ...makeRuns(9),
        makeRun({ id: 'nr1', resultadoObtido: 'NR', status: 'Rejeitada' }),
        makeRun({ id: 'nr2', resultadoObtido: 'NR', status: 'Rejeitada' }),
      ];
      expect(computeWestgardCategorico(runs).lotStatus).toBe('reprovado');
    });

    it('reprovado — lote_expirado (não apenas atencao)', () => {
      const run = makeRun({ validadeControle: '2019-06-01' });
      expect(computeWestgardCategorico([run]).lotStatus).toBe('reprovado');
    });
  });
});
