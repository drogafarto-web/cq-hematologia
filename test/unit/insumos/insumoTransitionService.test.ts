import { describe, it, expect } from 'vitest';
import {
  validateTransitionInput,
  type TransitionInput,
} from '../../../src/features/insumos/services/insumoTransitionService';

const base: Omit<TransitionInput, 'type'> = {
  module: 'hematologia',
  slot: 'activeReagenteId',
  fromInsumoId: 'insumo-old',
  toInsumoId: 'insumo-new',
  operadorId: 'uid-1',
  operadorName: 'Operador Teste',
};

describe('validateTransitionInput', () => {
  describe('tipos sem motivo obrigatório', () => {
    it('accepts swap sem motivo', () => {
      expect(() => validateTransitionInput({ ...base, type: 'swap' })).not.toThrow();
    });

    it('accepts activation com fromInsumoId=null', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'activation', fromInsumoId: null }),
      ).not.toThrow();
    });

    it('rejects activation com fromInsumoId diferente de null', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'activation', fromInsumoId: 'x' }),
      ).toThrow(/fromInsumoId=null/);
    });
  });

  describe('tipos que exigem motivo', () => {
    it('rejects correction sem motivo', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'correction' }),
      ).toThrow(/exige motivo/);
    });

    it('rejects correction com motivo vazio ou whitespace', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'correction', motivo: '   ' }),
      ).toThrow(/exige motivo/);
    });

    it('accepts correction com motivo', () => {
      expect(() =>
        validateTransitionInput({
          ...base,
          type: 'correction',
          motivo: 'Lote errado selecionado na troca anterior',
        }),
      ).not.toThrow();
    });

    it('rejects override-vencido sem motivo', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'override-vencido' }),
      ).toThrow(/exige motivo/);
    });

    it('accepts override-vencido com motivo', () => {
      expect(() =>
        validateTransitionInput({
          ...base,
          type: 'override-vencido',
          motivo: 'Lote novo em trânsito, liberação do QR atrasada',
        }),
      ).not.toThrow();
    });

    it('rejects override-qc-pendente sem motivo', () => {
      expect(() =>
        validateTransitionInput({ ...base, type: 'override-qc-pendente' }),
      ).toThrow(/exige motivo/);
    });
  });
});
