/**
 * Zod schema do formulário de Insumo. Discriminated union por `tipo` — garante
 * que campos específicos (ex: nivel em controle, analitosIncluidos em tira-uro)
 * só são validados quando relevantes.
 *
 * Formatos de data: ISO `YYYY-MM-DD` (input[type=date] nativo).
 */

import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const dateField = (msg = 'Formato inválido (YYYY-MM-DD)') =>
  z.string().regex(DATE_REGEX, msg);

// Campos comuns a todos os tipos
const baseShape = {
  modulo: z.enum(['hematologia', 'coagulacao', 'uroanalise', 'imunologia'], {
    required_error: 'Selecione o módulo.',
  }),
  fabricante: z.string().trim().min(2, 'Fabricante é obrigatório.'),
  nomeComercial: z.string().trim().min(2, 'Nome comercial é obrigatório.'),
  lote: z.string().trim().min(1, 'Lote é obrigatório.'),
  validade: dateField('Validade do fabricante é obrigatória.'),
  dataAbertura: dateField('Data de abertura inválida.').optional().or(z.literal('')),
  diasEstabilidadeAbertura: z.coerce
    .number()
    .int('Deve ser número inteiro.')
    .min(0, 'Não pode ser negativo.'),
  registroAnvisa: z.string().trim().optional(),
};

const controleSchema = z.object({
  tipo: z.literal('controle'),
  nivel: z.enum(['normal', 'patologico', 'baixo', 'alto'], {
    required_error: 'Selecione o nível do controle.',
  }),
  ...baseShape,
});

const reagenteSchema = z.object({
  tipo: z.literal('reagente'),
  ...baseShape,
});

const tiraUroSchema = z.object({
  tipo: z.literal('tira-uro'),
  // Forçar módulo = uroanalise (UI já pré-seleciona)
  modulo: z.literal('uroanalise', {
    errorMap: () => ({ message: 'Tiras de uroanálise só pertencem ao módulo uroanalise.' }),
  }),
  fabricante: baseShape.fabricante,
  nomeComercial: baseShape.nomeComercial,
  lote: baseShape.lote,
  validade: baseShape.validade,
  dataAbertura: baseShape.dataAbertura,
  diasEstabilidadeAbertura: baseShape.diasEstabilidadeAbertura,
  registroAnvisa: baseShape.registroAnvisa,
  notaFiscal: z.string().trim().optional(),
  fornecedor: z.string().trim().optional(),
  analitosIncluidos: z
    .array(z.string())
    .min(1, 'Informe ao menos um analito incluído.'),
});

// discriminatedUnion exige ZodObject puro — refines vão depois, no schema raiz.
export const InsumoFormSchema = z
  .discriminatedUnion('tipo', [controleSchema, reagenteSchema, tiraUroSchema])
  .refine((d) => !d.dataAbertura || d.dataAbertura <= d.validade, {
    message: 'Abertura não pode ser posterior à validade.',
    path: ['dataAbertura'],
  });

export type InsumoFormData = z.infer<typeof InsumoFormSchema>;
