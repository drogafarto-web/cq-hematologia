import { describe, it, expect } from 'vitest';
import {
  computeValidadeReal,
  isVencido,
  diasAteVencer,
  validadeStatus,
  WARNING_DAYS,
} from '../../../src/features/insumos/utils/validadeReal';

const d = (iso: string) => new Date(iso);

describe('computeValidadeReal', () => {
  it('retorna validade do fabricante quando insumo fechado', () => {
    const validade = d('2026-12-31');
    expect(computeValidadeReal(validade, null, 30).getTime()).toBe(validade.getTime());
  });

  it('retorna validade do fabricante quando estabilidade é 0 ou negativa', () => {
    const validade = d('2026-12-31');
    const abertura = d('2026-01-01');
    expect(computeValidadeReal(validade, abertura, 0).getTime()).toBe(validade.getTime());
    expect(computeValidadeReal(validade, abertura, -5).getTime()).toBe(validade.getTime());
  });

  it('aplica estabilidade pós-abertura quando ela vence antes da validade', () => {
    // Fabricante expira 2026-12-31, mas aberto em 2026-01-01 com 30d de estabilidade
    // → validade real = 2026-01-31
    const validade = d('2026-12-31');
    const abertura = d('2026-01-01T00:00:00Z');
    const result = computeValidadeReal(validade, abertura, 30);
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('mantém validade do fabricante quando abertura + estabilidade ultrapassa prateleira', () => {
    // Aberto 10 dias antes de vencer, mas estabilidade é 60 → válido até a validade do fabricante
    const validade = d('2026-12-31');
    const abertura = d('2026-12-21T00:00:00Z');
    const result = computeValidadeReal(validade, abertura, 60);
    expect(result.getTime()).toBe(validade.getTime());
  });
});

describe('isVencido', () => {
  it('true quando validadeReal é anterior a agora', () => {
    expect(isVencido(d('2020-01-01'), d('2026-01-01'))).toBe(true);
  });

  it('false quando validadeReal é posterior a agora', () => {
    expect(isVencido(d('2027-01-01'), d('2026-01-01'))).toBe(false);
  });

  it('false na fronteira exata (mesma instante = ainda ok)', () => {
    const ts = d('2026-01-01T12:00:00Z');
    expect(isVencido(ts, ts)).toBe(false);
  });
});

describe('diasAteVencer', () => {
  it('positivo quando falta tempo', () => {
    expect(diasAteVencer(d('2026-01-08'), d('2026-01-01'))).toBe(7);
  });

  it('zero no mesmo instante', () => {
    const ts = d('2026-01-01T00:00:00Z');
    expect(diasAteVencer(ts, ts)).toBe(0);
  });

  it('negativo quando já vencido', () => {
    expect(diasAteVencer(d('2025-12-25'), d('2026-01-01'))).toBe(-7);
  });

  it('arredonda para cima (frações de dia)', () => {
    // 1.5 dias → ceil = 2
    const now = d('2026-01-01T00:00:00Z');
    const futuro = d('2026-01-02T12:00:00Z');
    expect(diasAteVencer(futuro, now)).toBe(2);
  });
});

describe('validadeStatus', () => {
  const now = d('2026-01-01T00:00:00Z');

  it('"ok" quando fora da janela de warning', () => {
    const longe = new Date(now.getTime() + (WARNING_DAYS + 5) * 24 * 60 * 60 * 1000);
    expect(validadeStatus(longe, now)).toBe('ok');
  });

  it('"warning" dentro da janela de warning', () => {
    const perto = new Date(now.getTime() + (WARNING_DAYS - 1) * 24 * 60 * 60 * 1000);
    expect(validadeStatus(perto, now)).toBe('warning');
  });

  it('"warning" na fronteira WARNING_DAYS', () => {
    const limite = new Date(now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000);
    expect(validadeStatus(limite, now)).toBe('warning');
  });

  it('"expired" quando já passou', () => {
    const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(validadeStatus(ontem, now)).toBe('expired');
  });
});
