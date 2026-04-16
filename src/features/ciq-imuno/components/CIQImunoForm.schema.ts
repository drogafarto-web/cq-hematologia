import { z } from 'zod';

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Calcula a diferença em dias inteiros entre hoje e uma data de validade.
 * Negativo = já expirado.
 *
 * Usa `new Date(y, m, d)` para parse local — evita o deslocamento de fuso
 * causado por `new Date('YYYY-MM-DD')` que interpreta a string como UTC midnight,
 * resultando em datas erradas em timezones UTC-N (ex: UTC-3 no Brasil).
 */
export function daysToExpiry(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d, 0, 0, 0, 0); // local midnight

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const dateField  = (msg = 'Formato inválido (YYYY-MM-DD)') =>
  z.string().regex(DATE_REGEX, msg);

export const CIQImunoFormSchema = z
  .object({
    // Tipo de teste — lista dinâmica gerenciada via useCIQTestTypes (Firestore)
    testType: z.string({ required_error: 'Selecione o tipo de teste.' })
               .min(1, 'Selecione o tipo de teste.'),

    // Controle
    loteControle:       z.string().min(1, 'Lote do controle é obrigatório.'),
    fabricanteControle: z.string().min(1, 'Fabricante do controle é obrigatório.'),
    aberturaControle:   dateField('Data de abertura do controle inválida.'),
    validadeControle:   dateField('Data de validade do controle inválida.'),

    // Reagente
    loteReagente:       z.string().min(1, 'Lote do reagente é obrigatório.'),
    fabricanteReagente: z.string().min(1, 'Fabricante do reagente é obrigatório.'),
    reagenteStatus:     z.enum(['R', 'NR'], { required_error: 'Status de abertura do reagente obrigatório.' }),
    aberturaReagente:   dateField('Data de abertura do reagente inválida.'),
    validadeReagente:   dateField('Data de validade do reagente inválida.'),
    codigoKit:          z.string().optional(),
    registroANVISA:     z.string().optional(),

    // Operador
    cargo: z.enum(
      ['biomedico', 'tecnico', 'farmaceutico'],
      { required_error: 'Selecione o cargo do operador.' }
    ),

    // Resultado
    resultadoEsperado: z.enum(['R', 'NR'], { required_error: 'Resultado esperado obrigatório.' }),
    resultadoObtido:   z.enum(['R', 'NR'], { required_error: 'Resultado obtido obrigatório.' }),
    dataRealizacao:    dateField('Data de realização inválida.'),
    acaoCorretiva:     z.string().optional(),

    // Equipamento (opcionais)
    equipamento:        z.string().optional(),
    temperaturaAmbiente: z.coerce.number().optional(),
  })
  // Regra RDC 978: realização não pode ser após a validade do controle
  .refine((d) => d.dataRealizacao <= d.validadeControle, {
    message: 'Data de realização posterior à validade do controle.',
    path:    ['dataRealizacao'],
  })
  // Regra RDC 978: realização não pode ser após a validade do reagente
  .refine((d) => d.dataRealizacao <= d.validadeReagente, {
    message: 'Data de realização posterior à validade do reagente.',
    path:    ['dataRealizacao'],
  })
  // Abertura do controle não pode ser futura
  .refine((d) => d.aberturaControle <= d.dataRealizacao, {
    message: 'Data de abertura do controle não pode ser posterior à realização.',
    path:    ['aberturaControle'],
  })
  // RDC 978 Art.128: ação corretiva obrigatória em caso de não conformidade
  .refine(
    (d) => d.resultadoObtido === d.resultadoEsperado || Boolean(d.acaoCorretiva?.trim()),
    {
      message: 'Ação corretiva é obrigatória quando o resultado não está conforme.',
      path:    ['acaoCorretiva'],
    },
  );

export type CIQImunoFormData = z.infer<typeof CIQImunoFormSchema>;
