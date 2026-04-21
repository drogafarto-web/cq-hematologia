import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { hasQCValidationPending } from '../../../src/features/insumos/types/Insumo';
import type { Insumo } from '../../../src/features/insumos/types/Insumo';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const base = {
  id: 'i1',
  labId: 'lab-1',
  fabricante: 'HORIBA',
  nomeComercial: 'Diluente Yumizen',
  lote: 'L001',
  validade: Timestamp.fromDate(new Date('2026-12-31')),
  dataAbertura: null,
  diasEstabilidadeAbertura: 30,
  validadeReal: Timestamp.fromDate(new Date('2026-12-31')),
  status: 'ativo' as const,
  createdAt: Timestamp.fromDate(new Date('2026-04-01')),
  createdBy: 'uid-1',
};

const reagente = (override: Partial<Insumo> = {}): Insumo =>
  ({ ...base, tipo: 'reagente', modulo: 'hematologia', ...override }) as Insumo;

const tira = (override: Partial<Insumo> = {}): Insumo =>
  ({
    ...base,
    tipo: 'tira-uro',
    modulo: 'uroanalise',
    analitosIncluidos: ['ph', 'densidade'],
    ...override,
  }) as Insumo;

const controle = (override: Partial<Insumo> = {}): Insumo =>
  ({
    ...base,
    tipo: 'controle',
    modulo: 'hematologia',
    nivel: 'normal',
    ...override,
  }) as Insumo;

// ─── hasQCValidationPending ──────────────────────────────────────────────────

describe('hasQCValidationPending', () => {
  it('reagente sem flag retorna false', () => {
    expect(hasQCValidationPending(reagente())).toBe(false);
  });

  it('reagente com qcValidationRequired=true retorna true', () => {
    expect(hasQCValidationPending(reagente({ qcValidationRequired: true } as Partial<Insumo>))).toBe(
      true,
    );
  });

  it('reagente com qcValidationRequired=false retorna false', () => {
    expect(
      hasQCValidationPending(reagente({ qcValidationRequired: false } as Partial<Insumo>)),
    ).toBe(false);
  });

  it('tira-uro com flag=true retorna true', () => {
    expect(hasQCValidationPending(tira({ qcValidationRequired: true } as Partial<Insumo>))).toBe(
      true,
    );
  });

  it('controle (tipo=controle) sempre retorna false — não carrega o flag', () => {
    expect(hasQCValidationPending(controle())).toBe(false);
    // Mesmo com flag força-colocado, o narrowing por tipo impede propagação.
    const withForcedFlag = controle({ qcValidationRequired: true } as Partial<Insumo>);
    expect(hasQCValidationPending(withForcedFlag)).toBe(false);
  });
});
