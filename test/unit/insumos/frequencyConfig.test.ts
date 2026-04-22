import { describe, it, expect } from 'vitest';
import {
  validateFrequencyConfig,
  formatFrequencyConfig,
  frequencyToDays,
  legacyFrequencyToConfig,
} from '../../../src/features/insumos/types/FrequencyConfig';

describe('FrequencyConfig', () => {
  describe('validateFrequencyConfig', () => {
    it.each(['diaria', 'semanal', 'quinzenal', 'mensal'] as const)(
      'aceita %s sem frequencyDays',
      (t) => {
        expect(validateFrequencyConfig({ frequencyType: t })).toEqual({ ok: true });
      },
    );

    it('rejeita custom sem frequencyDays', () => {
      const r = validateFrequencyConfig({ frequencyType: 'custom' });
      expect(r.ok).toBe(false);
    });

    it('aceita custom no limite 1', () => {
      expect(validateFrequencyConfig({ frequencyType: 'custom', frequencyDays: 1 })).toEqual({
        ok: true,
      });
    });

    it('aceita custom no limite 180', () => {
      expect(validateFrequencyConfig({ frequencyType: 'custom', frequencyDays: 180 })).toEqual({
        ok: true,
      });
    });

    it.each([0, -1, 181, 365, NaN, Infinity])('rejeita custom com %s dias', (d) => {
      const r = validateFrequencyConfig({ frequencyType: 'custom', frequencyDays: d });
      expect(r.ok).toBe(false);
    });
  });

  describe('formatFrequencyConfig', () => {
    it('formata tipos fixos em português', () => {
      expect(formatFrequencyConfig({ frequencyType: 'diaria' })).toBe('Diária');
      expect(formatFrequencyConfig({ frequencyType: 'semanal' })).toBe('Semanal');
      expect(formatFrequencyConfig({ frequencyType: 'quinzenal' })).toBe('Quinzenal');
      expect(formatFrequencyConfig({ frequencyType: 'mensal' })).toBe('Mensal');
    });

    it('formata custom com número de dias', () => {
      expect(formatFrequencyConfig({ frequencyType: 'custom', frequencyDays: 7 })).toBe(
        'A cada 7 dias',
      );
    });
  });

  describe('frequencyToDays', () => {
    it('mapeia tipos fixos pros dias canônicos', () => {
      expect(frequencyToDays({ frequencyType: 'diaria' })).toBe(1);
      expect(frequencyToDays({ frequencyType: 'semanal' })).toBe(7);
      expect(frequencyToDays({ frequencyType: 'quinzenal' })).toBe(15);
      expect(frequencyToDays({ frequencyType: 'mensal' })).toBe(30);
    });

    it('retorna frequencyDays quando custom válido', () => {
      expect(frequencyToDays({ frequencyType: 'custom', frequencyDays: 45 })).toBe(45);
    });

    it('retorna null quando custom inválido', () => {
      expect(frequencyToDays({ frequencyType: 'custom' })).toBeNull();
      expect(frequencyToDays({ frequencyType: 'custom', frequencyDays: 200 })).toBeNull();
    });
  });

  describe('legacyFrequencyToConfig', () => {
    it('converte DIARIA → diaria', () => {
      expect(legacyFrequencyToConfig('DIARIA')).toEqual({ frequencyType: 'diaria' });
    });

    it('LOTE → custom 90d (fallback seguro)', () => {
      expect(legacyFrequencyToConfig('LOTE')).toEqual({
        frequencyType: 'custom',
        frequencyDays: 90,
      });
    });

    it('normaliza case', () => {
      expect(legacyFrequencyToConfig('diaria')).toEqual({ frequencyType: 'diaria' });
      expect(legacyFrequencyToConfig('Mensal')).toEqual({ frequencyType: 'mensal' });
    });
  });
});
