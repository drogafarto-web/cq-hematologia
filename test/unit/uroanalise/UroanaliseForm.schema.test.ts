import { describe, it, expect } from 'vitest';
import { UroanaliseFormSchema } from '../../../src/features/uroanalise/components/UroanaliseForm.schema';

const baseValid = {
  nivel: 'N' as const,
  frequencia: 'DIARIA' as const,
  loteTira: '04862025',
  operatorDocument: '12345',
  cargo: 'biomedico' as const,
  dataRealizacao: '2026-06-02',
  resultados: {},
  resultadosEsperadosRun: {},
};

describe('UroanaliseFormSchema — Fase Worklab (2026-06-02)', () => {
  it('aceita aberturaTiraId como string simples', () => {
    const r = UroanaliseFormSchema.safeParse({ ...baseValid, aberturaTiraId: 'abc-123' });
    expect(r.success).toBe(true);
  });

  it('rejeita aberturaTiraId vazio quando preenchido', () => {
    const r = UroanaliseFormSchema.safeParse({ ...baseValid, aberturaTiraId: '' });
    expect(r.success).toBe(false);
  });

  it('aceita aberturaTiraId ausente (preenchido depois pelo pipeline de save)', () => {
    const r = UroanaliseFormSchema.safeParse(baseValid);
    expect(r.success).toBe(true);
  });

  it('permite campos opcionais do picker sem quebrar parse', () => {
    const r = UroanaliseFormSchema.safeParse({
      ...baseValid,
      aberturaTiraId: 'abc-123',
    });
    expect(r.success).toBe(true);
  });
});
