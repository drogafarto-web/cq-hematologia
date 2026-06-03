import { describe, it, expect } from 'vitest';
import { UroanaliseFormSchema } from '../UroanaliseForm.schema';

describe('UroanaliseFormSchema Validation', () => {
  it('should accept empty strings in optional fields', () => {
    const validData = {
      nivel: 'P',
      frequencia: 'DIARIA',
      loteTira: 'LOTE-TIRA-123',
      aberturaTiraId: '', // Should be accepted as valid
      aberturaControleId: '', // Should be accepted as valid
      aberturaControle: '', // Should be accepted as valid
      validadeControle: '', // Should be accepted as valid
      validadeTira: '',
      operatorDocument: '123456789',
      cargo: 'biomedico',
      dataRealizacao: '2026-06-03',
      resultados: {},
      resultadosEsperadosRun: {},
    };

    const parsed = UroanaliseFormSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });
});
