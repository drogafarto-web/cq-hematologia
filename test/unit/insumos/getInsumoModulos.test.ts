import { describe, it, expect } from 'vitest';
import { getInsumoModulos } from '../../../src/features/insumos/types/Insumo';
import type { InsumoModulo } from '../../../src/features/insumos/types/Insumo';

describe('getInsumoModulos (backward-compat)', () => {
  it('returns modulos[] when present and non-empty', () => {
    expect(
      getInsumoModulos({
        modulo: 'hematologia',
        modulos: ['hematologia', 'coagulacao'],
      }),
    ).toEqual<InsumoModulo[]>(['hematologia', 'coagulacao']);
  });

  it('falls back to [modulo] when modulos missing', () => {
    expect(
      getInsumoModulos({
        modulo: 'uroanalise',
        modulos: undefined as unknown as InsumoModulo[],
      }),
    ).toEqual<InsumoModulo[]>(['uroanalise']);
  });

  it('falls back to [modulo] when modulos is empty array', () => {
    expect(
      getInsumoModulos({
        modulo: 'coagulacao',
        modulos: [],
      }),
    ).toEqual<InsumoModulo[]>(['coagulacao']);
  });

  it('returns [] when neither field populated (corrupt doc)', () => {
    expect(
      getInsumoModulos({
        modulo: undefined as unknown as InsumoModulo,
        modulos: undefined as unknown as InsumoModulo[],
      }),
    ).toEqual([]);
  });

  it('prefers modulos over modulo when both present', () => {
    // Cenário pós-backfill: modulo pode refletir valor antigo; modulos é SoT.
    expect(
      getInsumoModulos({
        modulo: 'hematologia',
        modulos: ['imunologia'],
      }),
    ).toEqual<InsumoModulo[]>(['imunologia']);
  });
});
