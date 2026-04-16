import { describe, it, expect } from 'vitest';
import { CIQImunoFormSchema, daysToExpiry } from '../../../src/features/ciq-imuno/components/CIQImunoForm.schema';

// ─── Payload base válido ──────────────────────────────────────────────────────

const VALID: Record<string, unknown> = {
  testType:           'HIV',
  loteControle:       'L2024-001',
  fabricanteControle: 'BioSystems',
  aberturaControle:   '2024-01-01',
  validadeControle:   '2099-12-31',
  loteReagente:       'R2024-001',
  fabricanteReagente: 'Abbott',
  reagenteStatus:     'R',
  aberturaReagente:   '2024-01-01',
  validadeReagente:   '2099-12-31',
  cargo:              'biomedico',
  resultadoEsperado:  'R',
  resultadoObtido:    'R',
  dataRealizacao:     '2024-06-01',
};

// ─── daysToExpiry ─────────────────────────────────────────────────────────────

describe('daysToExpiry', () => {
  it('retorna valor negativo para data expirada', () => {
    expect(daysToExpiry('2000-01-01')).toBeLessThan(0);
  });

  it('retorna valor positivo para data futura', () => {
    expect(daysToExpiry('2099-12-31')).toBeGreaterThan(0);
  });

  it('retorna 0 para hoje (data local)', () => {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const d   = String(now.getDate()).padStart(2, '0');
    expect(daysToExpiry(`${y}-${m}-${d}`)).toBe(0);
  });

  it('diferença de 1 dia é exatamente 1', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    expect(daysToExpiry(`${y}-${m}-${d}`)).toBe(1);
  });
});

// ─── CIQImunoFormSchema — campos obrigatórios ─────────────────────────────────

describe('CIQImunoFormSchema — campos obrigatórios', () => {
  it('aceita payload completamente válido', () => {
    const result = CIQImunoFormSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('rejeita testType vazio (lista de tipos é dinâmica, mas não pode ser string vazia)', () => {
    // testType é z.string().min(1) — qualquer string não-vazia é válida (tipos gerenciados no Firestore)
    const r = CIQImunoFormSchema.safeParse({ ...VALID, testType: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.testType).toBeDefined();
  });

  it('rejeita testType ausente', () => {
    const { testType: _, ...rest } = VALID;
    const r = CIQImunoFormSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it('rejeita loteControle vazio', () => {
    const r = CIQImunoFormSchema.safeParse({ ...VALID, loteControle: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.loteControle).toBeDefined();
  });

  it('rejeita fabricanteControle vazio', () => {
    const r = CIQImunoFormSchema.safeParse({ ...VALID, fabricanteControle: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.fabricanteControle).toBeDefined();
  });

  it('rejeita fabricanteReagente ausente', () => {
    const { fabricanteReagente: _, ...rest } = VALID;
    const r = CIQImunoFormSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it('rejeita reagenteStatus inválido', () => {
    const r = CIQImunoFormSchema.safeParse({ ...VALID, reagenteStatus: 'X' });
    expect(r.success).toBe(false);
  });

  it('rejeita cargo inválido', () => {
    const r = CIQImunoFormSchema.safeParse({ ...VALID, cargo: 'medico' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.cargo).toBeDefined();
  });

  it('rejeita cargo ausente', () => {
    const { cargo: _, ...rest } = VALID;
    const r = CIQImunoFormSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it('aceita todos os cargos válidos', () => {
    for (const cargo of ['biomedico', 'tecnico', 'farmaceutico'] as const) {
      const r = CIQImunoFormSchema.safeParse({ ...VALID, cargo });
      expect(r.success, `cargo "${cargo}" deveria ser válido`).toBe(true);
    }
  });

  it('rejeita resultadoObtido ausente', () => {
    const { resultadoObtido: _, ...rest } = VALID;
    const r = CIQImunoFormSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

// ─── Validação de formato de data ─────────────────────────────────────────────

describe('CIQImunoFormSchema — formato de data (YYYY-MM-DD)', () => {
  const dateFields = [
    'aberturaControle', 'validadeControle',
    'aberturaReagente', 'validadeReagente',
    'dataRealizacao',
  ] as const;

  for (const field of dateFields) {
    it(`rejeita ${field} com formato inválido (DD/MM/YYYY)`, () => {
      const r = CIQImunoFormSchema.safeParse({ ...VALID, [field]: '01/01/2024' });
      expect(r.success).toBe(false);
    });

    it(`rejeita ${field} com string vazia`, () => {
      const r = CIQImunoFormSchema.safeParse({ ...VALID, [field]: '' });
      expect(r.success).toBe(false);
    });
  }
});

// ─── Refinements RDC 978 ──────────────────────────────────────────────────────

describe('CIQImunoFormSchema — refinements RDC 978/2025', () => {

  it('rejeita dataRealizacao posterior à validadeControle', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      validadeControle: '2024-01-31',
      dataRealizacao:   '2024-02-15',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.dataRealizacao).toBeDefined();
    }
  });

  it('aceita dataRealizacao igual à validadeControle (boundary)', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      validadeControle: '2024-06-01',
      dataRealizacao:   '2024-06-01',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita dataRealizacao posterior à validadeReagente', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      validadeReagente: '2024-01-31',
      dataRealizacao:   '2024-02-01',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.dataRealizacao).toBeDefined();
    }
  });

  it('aceita dataRealizacao igual à validadeReagente (boundary)', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      validadeReagente: '2024-06-01',
      dataRealizacao:   '2024-06-01',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita aberturaControle posterior à dataRealizacao', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      aberturaControle: '2024-07-01',
      dataRealizacao:   '2024-06-01',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.aberturaControle).toBeDefined();
    }
  });

  it('aceita aberturaControle igual à dataRealizacao (boundary)', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      aberturaControle: '2024-06-01',
      dataRealizacao:   '2024-06-01',
    });
    expect(r.success).toBe(true);
  });

  it('aceita todos os TestTypes válidos', () => {
    const testTypes = ['HCG', 'BhCG', 'HIV', 'HBsAg', 'Anti-HCV', 'Sifilis', 'Dengue', 'COVID', 'PCR', 'Troponina'];
    for (const testType of testTypes) {
      const r = CIQImunoFormSchema.safeParse({ ...VALID, testType });
      expect(r.success, `testType "${testType}" deveria ser válido`).toBe(true);
    }
  });

  it('múltiplos erros de refinement são reportados independentemente', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      aberturaControle: '2024-08-01', // > dataRealizacao
      validadeControle: '2024-05-01', // < dataRealizacao
      validadeReagente: '2024-05-01', // < dataRealizacao
      dataRealizacao:   '2024-06-01',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errCount = Object.keys(r.error.flatten().fieldErrors).length;
      expect(errCount).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── Ação Corretiva (RDC 978/2025 Art.128) ────────────────────────────────────

describe('CIQImunoFormSchema — acaoCorretiva', () => {

  it('aceita payload conforme sem acaoCorretiva', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      resultadoEsperado: 'R',
      resultadoObtido:   'R',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita não conformidade sem acaoCorretiva', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      resultadoEsperado: 'R',
      resultadoObtido:   'NR',
      // sem acaoCorretiva
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.acaoCorretiva).toBeDefined();
    }
  });

  it('rejeita não conformidade com acaoCorretiva só com espaços', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      resultadoEsperado: 'R',
      resultadoObtido:   'NR',
      acaoCorretiva:     '   ',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.acaoCorretiva).toBeDefined();
    }
  });

  it('aceita não conformidade com acaoCorretiva preenchida', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      resultadoEsperado: 'R',
      resultadoObtido:   'NR',
      acaoCorretiva:     'Reagente descartado e teste repetido com novo kit.',
    });
    expect(r.success).toBe(true);
  });

  it('não exige acaoCorretiva quando NR esperado e NR obtido (conforme)', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      resultadoEsperado: 'NR',
      resultadoObtido:   'NR',
    });
    expect(r.success).toBe(true);
  });
});

// ─── Campos opcionais ─────────────────────────────────────────────────────────

describe('CIQImunoFormSchema — campos opcionais', () => {

  it('aceita payload com todos os campos opcionais preenchidos', () => {
    const r = CIQImunoFormSchema.safeParse({
      ...VALID,
      codigoKit:           'KIT-0042',
      registroANVISA:      '10269230117',
      equipamento:         'Mini VIDAS',
      temperaturaAmbiente: 22.5,
    });
    expect(r.success).toBe(true);
  });

  it('aceita payload sem nenhum campo opcional', () => {
    const r = CIQImunoFormSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it('temperaturaAmbiente é coercido de string para número', () => {
    const r = CIQImunoFormSchema.safeParse({ ...VALID, temperaturaAmbiente: '22.5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.temperaturaAmbiente).toBe(22.5);
  });
});
