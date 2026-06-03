/**
 * NOTIVISA Module Integration Tests
 * Phase 4 placeholder tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { notivisaFormatter, validateNotivisaPayload } from '../../shared/notivisa';
import {
  mockPaciente,
  mockLaudo,
  mockNotivisaPayload,
  mockLaudoMissingCPF,
  mockPacienteMissingCPF,
  mockLaudoEmptyResultados,
} from '../fixtures/notivisa-payloads';

describe('NOTIVISA Module', () => {
  describe('notivisaFormatter', () => {
    it('should format valid laudo to NOTIVISA payload', () => {
      const result = notivisaFormatter(mockLaudo, mockPaciente);
      expect(result).toBeDefined();
      expect(result.versao).toBe('1.0');
      expect(result.laudo_id).toBe(mockLaudo.id);
      expect(result.paciente_cpf).toBe(mockPaciente.cpf);
      expect(result.resultados.length).toBeGreaterThan(0);
      expect(result.assinador).toBeDefined();
    });

    it('should throw error when patient CPF is missing', () => {
      expect(() => {
        notivisaFormatter(mockLaudo, mockPacienteMissingCPF as any);
      }).toThrow(/CPF/i);
    });

    it('should throw error when laudo has empty resultados', () => {
      expect(() => {
        notivisaFormatter(mockLaudoEmptyResultados, mockPaciente);
      }).toThrow(/result/i);
    });

    it('should throw error when assinatura is missing operatorCpf', () => {
      const laudoNoSig = { ...mockLaudo };
      laudoNoSig.assinatura = { operatorCpf: '', ts: 1714982400000 };
      expect(() => {
        notivisaFormatter(laudoNoSig, mockPaciente);
      }).toThrow(/operatorCpf/i);
    });
  });

  describe('validateNotivisaPayload', () => {
    it('should validate correct NOTIVISA payload', () => {
      const result = validateNotivisaPayload(mockNotivisaPayload);
      expect(result).toEqual(mockNotivisaPayload);
    });

    it('should reject payload with invalid CPF format', () => {
      const invalidPayload = { ...mockNotivisaPayload };
      invalidPayload.paciente_cpf = 'invalid-cpf';
      expect(() => validateNotivisaPayload(invalidPayload)).toThrow();
    });

    it('should reject payload with missing required fields', () => {
      const incompletePayload = { ...mockNotivisaPayload };
      delete incompletePayload.laudo_id;
      expect(() => validateNotivisaPayload(incompletePayload)).toThrow();
    });

    it('should reject payload with invalid version', () => {
      const wrongVersion = { ...mockNotivisaPayload, versao: '2.0' };
      expect(() => validateNotivisaPayload(wrongVersion)).toThrow();
    });
  });

  describe('Integration: Formatter + Validator', () => {
    it('should format and validate without error', () => {
      const formatted = notivisaFormatter(mockLaudo, mockPaciente);
      const validated = validateNotivisaPayload(formatted);
      expect(validated).toEqual(formatted);
    });

    it('should maintain all resultados through format-validate cycle', () => {
      const formatted = notivisaFormatter(mockLaudo, mockPaciente);
      expect(formatted.resultados.length).toBe(mockLaudo.resultados.length);
      formatted.resultados.forEach((r, idx) => {
        expect(r.analito).toBe(mockLaudo.resultados[idx].analito);
        expect(r.valor).toBe(mockLaudo.resultados[idx].valor);
      });
    });
  });
});
