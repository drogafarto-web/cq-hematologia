import { describe, it, expect } from 'vitest';
import {
  checkWestgardRules,
  isRejection,
  isWarningOnly,
} from '../../../src/features/chart/utils/westgardRules';
import type { AnalyteStats } from '../../../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stats com mean=0, sd=1 → z-score = valor passado diretamente.
 * Simplifica os testes: basta passar o z-score desejado como valor.
 */
const UNIT_STATS: AnalyteStats = { mean: 0, sd: 1 };

/** Avalia a regra com current e N valores anteriores (mais novo primeiro). */
function check(current: number, previous: number[] = [], stats = UNIT_STATS) {
  return checkWestgardRules(current, previous, stats);
}

// ─── sd inválido ──────────────────────────────────────────────────────────────

describe('checkWestgardRules — sd inválido', () => {
  it('retorna [] quando sd === 0', () => {
    expect(check(5, [], { mean: 0, sd: 0 })).toEqual([]);
  });

  it('retorna [] quando sd < 0', () => {
    expect(check(5, [], { mean: 0, sd: -1 })).toEqual([]);
  });
});

// ─── Sem violações ────────────────────────────────────────────────────────────

describe('checkWestgardRules — sem violações', () => {
  it('valor dentro de ±1 SD não gera nenhuma violação', () => {
    expect(check(0)).toEqual([]);
    expect(check(1)).toEqual([]);
    expect(check(-1)).toEqual([]);
    expect(check(1.99)).toEqual([]);
  });
});

// ─── Regra 1-2s (Warning: |z| >= 2) ──────────────────────────────────────────

describe('1-2s — warning: |z| >= 2', () => {
  it('ATIVA em exatamente +2 SD (boundary inclusivo)', () => {
    expect(check(2)).toContain('1-2s');
  });

  it('ATIVA em exatamente -2 SD (boundary inclusivo)', () => {
    expect(check(-2)).toContain('1-2s');
  });

  it('ATIVA acima de 2 SD', () => {
    expect(check(2.5)).toContain('1-2s');
  });

  it('NÃO ativa abaixo de 2 SD', () => {
    expect(check(1.99)).not.toContain('1-2s');
  });

  it('NÃO ativa em 0', () => {
    expect(check(0)).not.toContain('1-2s');
  });

  it('1-2s não é uma violação de rejeição', () => {
    expect(isRejection(['1-2s'])).toBe(false);
  });
});

// ─── Regra 1-3s (Rejeição: |z| >= 3) ────────────────────────────────────────

describe('1-3s — rejeição: |z| >= 3', () => {
  it('ATIVA em exatamente +3 SD (boundary inclusivo)', () => {
    expect(check(3)).toContain('1-3s');
  });

  it('ATIVA em exatamente -3 SD (boundary inclusivo)', () => {
    expect(check(-3)).toContain('1-3s');
  });

  it('ATIVA além de 3 SD', () => {
    expect(check(4)).toContain('1-3s');
    expect(check(-3.1)).toContain('1-3s');
  });

  it('NÃO ativa abaixo de 3 SD', () => {
    expect(check(2.99)).not.toContain('1-3s');
  });

  it('valor >= 3 SD acumula 1-2s e 1-3s simultaneamente', () => {
    const v = check(3);
    expect(v).toContain('1-2s');
    expect(v).toContain('1-3s');
  });

  it('1-3s é uma violação de rejeição', () => {
    expect(isRejection(['1-3s'])).toBe(true);
  });
});

// ─── Regra 2-2s (Rejeição: 2 consecutivos >= ±2 SD, mesmo lado) ──────────────

describe('2-2s — rejeição: 2 consecutivos >= ±2 SD no mesmo lado', () => {
  it('ATIVA com z0=+2.5 e z1=+2.5 (mesmo lado positivo)', () => {
    expect(check(2.5, [2.5])).toContain('2-2s');
  });

  it('ATIVA com z0=-2.5 e z1=-2.5 (mesmo lado negativo)', () => {
    expect(check(-2.5, [-2.5])).toContain('2-2s');
  });

  it('ATIVA nos boundaries: z0=+2 e z1=+2', () => {
    expect(check(2, [2])).toContain('2-2s');
  });

  it('NÃO ativa quando os valores estão em lados opostos (+2.5 e -2.5)', () => {
    expect(check(2.5, [-2.5])).not.toContain('2-2s');
  });

  it('NÃO ativa quando z0 < 2 (mesmo z1 > 2)', () => {
    expect(check(1.9, [2.5])).not.toContain('2-2s');
  });

  it('NÃO ativa quando z1 < 2 (mesmo z0 > 2)', () => {
    expect(check(2.5, [1.9])).not.toContain('2-2s');
  });

  it('NÃO ativa sem valores anteriores', () => {
    expect(check(3)).not.toContain('2-2s');
  });

  it('2-2s é uma violação de rejeição', () => {
    expect(isRejection(['2-2s'])).toBe(true);
  });
});

// ─── Regra R-4s (Rejeição: amplitude entre 2 consecutivos >= 4 SD) ────────────

describe('R-4s — rejeição: amplitude entre 2 consecutivos >= 4 SD', () => {
  it('ATIVA quando span é exatamente 4 SD (z0=+2 e z1=-2)', () => {
    expect(check(2, [-2])).toContain('R-4s');
  });

  it('ATIVA quando span supera 4 SD (z0=+2.5 e z1=-2.5)', () => {
    expect(check(2.5, [-2.5])).toContain('R-4s');
  });

  it('ATIVA com polaridades opostas de grande amplitude', () => {
    expect(check(3, [-2])).toContain('R-4s'); // span = 5
  });

  it('NÃO ativa quando span < 4 SD (z0=+1.9 e z1=-2)', () => {
    expect(check(1.9, [-2])).not.toContain('R-4s'); // span = 3.9
  });

  it('NÃO ativa sem valores anteriores', () => {
    expect(check(5)).not.toContain('R-4s');
  });

  it('R-4s é uma violação de rejeição', () => {
    expect(isRejection(['R-4s'])).toBe(true);
  });
});

// ─── Regra 4-1s (Rejeição: 4 consecutivos além de ±1 SD, mesmo lado) ─────────

describe('4-1s — rejeição: 4 consecutivos >= ±1 SD no mesmo lado', () => {
  it('ATIVA com 4 valores no lado positivo', () => {
    expect(check(1.5, [1.2, 1.1, 1.3])).toContain('4-1s');
  });

  it('ATIVA com 4 valores no lado negativo', () => {
    expect(check(-1.5, [-1.2, -1.1, -1.3])).toContain('4-1s');
  });

  it('ATIVA nos boundaries: todos exatamente ±1 SD', () => {
    expect(check(1, [1, 1, 1])).toContain('4-1s');
    expect(check(-1, [-1, -1, -1])).toContain('4-1s');
  });

  it('NÃO ativa quando um valor não atinge 1 SD', () => {
    expect(check(1.5, [1.2, 0.9, 1.3])).not.toContain('4-1s');
  });

  it('NÃO ativa quando os valores estão em lados opostos', () => {
    expect(check(1.5, [1.2, -1.2, 1.3])).not.toContain('4-1s');
  });

  it('NÃO ativa com apenas 3 valores (< 4 necessários)', () => {
    expect(check(1.5, [1.2, 1.1])).not.toContain('4-1s');
  });

  it('4-1s é uma violação de rejeição', () => {
    expect(isRejection(['4-1s'])).toBe(true);
  });
});

// ─── Regra 6T (Rejeição: 6 consecutivos em tendência monotônica) ───────────────

describe('6T — rejeição: 6 consecutivos em tendência crescente ou decrescente', () => {
  // previous está em ordem mais-novo-primeiro (newest→oldest)
  // A regra inverte para cronológico antes de avaliar

  it('ATIVA para tendência crescente no tempo (oldest→newest sobe)', () => {
    // Cronológico: 1 → 2 → 3 → 4 → 5 → 6
    // newest→oldest passado como: current=6, previous=[5,4,3,2,1]
    expect(check(6, [5, 4, 3, 2, 1])).toContain('6T');
  });

  it('ATIVA para tendência decrescente no tempo (oldest→newest cai)', () => {
    // Cronológico: -1 → -2 → -3 → -4 → -5 → -6
    // newest→oldest: current=-6, previous=[-5,-4,-3,-2,-1]
    expect(check(-6, [-5, -4, -3, -2, -1])).toContain('6T');
  });

  it('NÃO ativa quando a tendência é interrompida', () => {
    // Cronológico: 1 → 2 → 4 → 3 → 5 → 6 (não monotônico)
    // newest→oldest: current=6, previous=[5,3,4,2,1]
    expect(check(6, [5, 3, 4, 2, 1])).not.toContain('6T');
  });

  it('NÃO ativa com apenas 4 valores anteriores (precisa de 5)', () => {
    expect(check(5, [4, 3, 2, 1])).not.toContain('6T');
  });

  it('NÃO ativa para série plana (sem tendência estrita)', () => {
    // Todos iguais não é monotônico estrito
    expect(check(2, [2, 2, 2, 2, 2])).not.toContain('6T');
  });

  it('6T é uma violação de rejeição', () => {
    expect(isRejection(['6T'])).toBe(true);
  });
});

// ─── Regra 6X (Rejeição: 6 consecutivos no mesmo lado da média) ──────────────

describe('6X — rejeição: 6 consecutivos no mesmo lado da média', () => {
  it('ATIVA com 6 valores positivos (z > 0)', () => {
    expect(check(1, [2, 0.5, 1.5, 0.8, 1.2])).toContain('6X');
  });

  it('ATIVA com 6 valores negativos (z < 0)', () => {
    expect(check(-1, [-2, -0.5, -1.5, -0.8, -1.2])).toContain('6X');
  });

  it('NÃO ativa quando um valor está do lado oposto', () => {
    expect(check(1, [2, -0.1, 1.5, 0.8, 1.2])).not.toContain('6X');
  });

  it('NÃO ativa com apenas 4 anteriores (precisa de 5)', () => {
    expect(check(1, [1, 1, 1, 1])).not.toContain('6X');
  });

  it('6X é uma violação de rejeição', () => {
    expect(isRejection(['6X'])).toBe(true);
  });
});

// ─── Regra 10x (Rejeição: 10 consecutivos no mesmo lado) ─────────────────────

describe('10x — rejeição: 10 consecutivos no mesmo lado da média', () => {
  it('ATIVA com 10 valores positivos', () => {
    expect(check(0.5, [0.3, 0.4, 0.2, 0.6, 0.1, 0.5, 0.3, 0.4, 0.2])).toContain('10x');
  });

  it('ATIVA com 10 valores negativos', () => {
    expect(check(-0.5, [-0.3, -0.4, -0.2, -0.6, -0.1, -0.5, -0.3, -0.4, -0.2])).toContain('10x');
  });

  it('NÃO ativa quando um dos 10 está do lado oposto', () => {
    expect(check(0.5, [0.3, 0.4, -0.1, 0.6, 0.1, 0.5, 0.3, 0.4, 0.2])).not.toContain('10x');
  });

  it('NÃO ativa com apenas 8 anteriores (precisa de 9)', () => {
    const eightPrev = Array(8).fill(0.5);
    expect(check(0.5, eightPrev)).not.toContain('10x');
  });

  it('usa exatamente os 10 mais recentes — anteriores além de 9 são ignorados', () => {
    // 9 positivos + 10 negativos mais antigos → 10x não deve ativar
    const prev = [
      0.3,
      0.4,
      0.2,
      0.6,
      0.1,
      0.5,
      0.3,
      0.4,
      0.2, // 9 positivos (mais recentes)
      -0.5,
      -0.3,
      -0.4,
      -0.2, // 4 negativos (ignorados)
    ];
    // current positivo + 9 positivos = 10 positivos na janela → ativa
    expect(check(0.1, prev)).toContain('10x');
  });

  it('10x é uma violação de rejeição', () => {
    expect(isRejection(['10x'])).toBe(true);
  });
});

// ─── Múltiplas violações simultâneas ─────────────────────────────────────────

describe('múltiplas violações simultâneas', () => {
  it('1-2s e 1-3s ativam juntas para |z| >= 3', () => {
    const v = check(3);
    expect(v).toContain('1-2s');
    expect(v).toContain('1-3s');
  });

  it('2-2s e R-4s podem coexistir para valores em lados opostos com span >= 4', () => {
    // z0=3, z1=-2 → span=5 (R-4s), mas lados opostos (não 2-2s)
    const v = check(3, [-2]);
    expect(v).toContain('R-4s');
    expect(v).not.toContain('2-2s');
  });
});

// ─── isRejection ──────────────────────────────────────────────────────────────

describe('isRejection', () => {
  it('retorna false para lista vazia', () => {
    expect(isRejection([])).toBe(false);
  });

  it('retorna false para apenas 1-2s (warning)', () => {
    expect(isRejection(['1-2s'])).toBe(false);
  });

  it('retorna true para cada regra de rejeição individualmente', () => {
    for (const rule of ['1-3s', '2-2s', 'R-4s', '4-1s', '10x', '6T', '6X'] as const) {
      expect(isRejection([rule]), `${rule} deve ser rejeição`).toBe(true);
    }
  });

  it('retorna true quando lista mista contém ao menos uma rejeição', () => {
    expect(isRejection(['1-2s', '1-3s'])).toBe(true);
  });
});

// ─── isWarningOnly ────────────────────────────────────────────────────────────

describe('isWarningOnly', () => {
  it('retorna false para lista vazia', () => {
    expect(isWarningOnly([])).toBe(false);
  });

  it('retorna true para apenas 1-2s', () => {
    expect(isWarningOnly(['1-2s'])).toBe(true);
  });

  it('retorna false quando há qualquer rejeição', () => {
    expect(isWarningOnly(['1-2s', '1-3s'])).toBe(false);
    expect(isWarningOnly(['1-3s'])).toBe(false);
  });
});

// ─── Stats com mean e sd arbitrários ─────────────────────────────────────────

describe('checkWestgardRules — z-score com stats reais', () => {
  it('calcula z-score corretamente antes de avaliar as regras', () => {
    // mean=100, sd=10: valor 120 → z=+2 → deve ativar 1-2s
    expect(checkWestgardRules(120, [], { mean: 100, sd: 10 })).toContain('1-2s');
    // valor 80 → z=-2 → deve ativar 1-2s
    expect(checkWestgardRules(80, [], { mean: 100, sd: 10 })).toContain('1-2s');
    // valor 110 → z=+1 → sem violação
    expect(checkWestgardRules(110, [], { mean: 100, sd: 10 })).toEqual([]);
  });

  it('avalia 2-2s com valores reais', () => {
    // mean=100, sd=10: valor 120 → z=+2.0 exato, anterior 120 → 2-2s
    // Evita floating-point: (8.1-7.5)/0.3 ≈ 1.9999... (< 2 em IEEE-754)
    const v = checkWestgardRules(120, [120], { mean: 100, sd: 10 });
    expect(v).toContain('2-2s');
  });
});
