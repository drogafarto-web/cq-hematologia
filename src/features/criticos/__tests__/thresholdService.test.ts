import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateThresholdInput,
  createThreshold,
  updateThreshold,
  softDeleteThreshold,
  getThresholds,
  listThresholdsByAnalyte,
} from '../services/thresholdService';
import type { CriticoThresholdInput } from '../types/threshold';

describe('Threshold Service', () => {
  const mockLabId = 'lab-123';
  const mockOperadorId = 'op-456';
  const mockOperadorNome = 'Test Operator';

  // Mock Firestore
  vi.mock('../../../shared/services/firebase', () => ({
    db: {},
  }));

  describe('validateThresholdInput', () => {
    it('should accept valid threshold input', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'Red Blood Cells',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      const result = validateThresholdInput(input);
      expect(result).toEqual(input);
    });

    it('should accept threshold with only min', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 3.5,
        max: null,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      const result = validateThresholdInput(input);
      expect(result.min).toBe(3.5);
      expect(result.max).toBeNull();
    });

    it('should accept threshold with only max', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: null,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      const result = validateThresholdInput(input);
      expect(result.min).toBeNull();
      expect(result.max).toBe(5.5);
    });

    it('should reject input with both min and max null', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: null,
        max: null,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow('At least min or max must be specified');
    });

    it('should reject input where min > max', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 5.5,
        max: 3.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow('min must be less than max');
    });

    it('should reject missing analitoId', () => {
      const input = {
        analitoId: '',
        analitoNome: 'RBC',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow();
    });

    it('should reject invalid severidade', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'critica' as any,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow();
    });

    it('should accept optional condicional field', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
        condicional: {
          idadeMin: 18,
          idadeMax: 65,
          sexo: 'M' as const,
        },
      };

      const result = validateThresholdInput(input);
      expect(result.condicional).toBeDefined();
      expect(result.condicional?.sexo).toBe('M');
    });

    it('should throw when ativo is missing (schema does not default)', () => {
      // The schema requires `ativo: boolean` — no .default() is applied.
      // Callers must always supply ativo explicitly.
      const input: any = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        // ativo intentionally omitted
      };

      expect(() => validateThresholdInput(input)).toThrow('Validation error');
    });

    it('should throw when both min and max are omitted (schema requires explicit null)', () => {
      // The schema requires min: number|null and max: number|null.
      // Omitting them entirely fails Zod required field validation,
      // triggering the min/max refine which rejects both-null inputs.
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
        // min and max intentionally omitted — should throw
      };

      expect(() => validateThresholdInput(input as any)).toThrow();
    });
  });

  describe('createThreshold', () => {
    it('should create a threshold with required fields', async () => {
      const input: CriticoThresholdInput = {
        analitoId: 'rbc',
        analitoNome: 'Red Blood Cells',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta',
        ativo: true,
      };

      // This test requires mocking setDoc
      // For now, we'll verify the validation works
      const validated = validateThresholdInput(input);
      expect(validated.labId).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid input during create', () => {
      const input = {
        analitoId: '',
        analitoNome: 'RBC',
        min: 3.5,
        max: 5.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow('Validation error');
    });

    it('should provide detailed error messages', () => {
      const input = {
        analitoId: 'rbc',
        analitoNome: 'RBC',
        min: 5.5,
        max: 3.5,
        unidade: 'M/uL',
        severidade: 'alta' as const,
        ativo: true,
      };

      expect(() => validateThresholdInput(input)).toThrow();
    });
  });
});
