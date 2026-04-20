import { z } from 'zod';

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Calcula a diferença em dias inteiros entre hoje e uma data de validade.
 * Negativo = já expirado.
 *
 * Parse local (not UTC) para evitar drift de fuso.
 */
export function daysToExpiry(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d, 0, 0, 0, 0);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const dateField  = (msg = 'Formato inválido (YYYY-MM-DD)') =>
  z.string().regex(DATE_REGEX, msg);

const UroFieldOrigemSchema = z.enum(['MANUAL', 'OCR_ACEITO', 'OCR_EDITADO', 'OCR_REJEITADO']);

const UroValorCategoricoSchema = z.enum([
  'NEGATIVO', 'TRACOS', '1+', '2+', '3+', '4+', 'NORMAL', 'AUMENTADO', 'PRESENTE',
]);

const UroFieldAuditadoCategoricoSchema = z.object({
  valor:        UroValorCategoricoSchema.nullable(),
  origem:       UroFieldOrigemSchema,
  ocrConfianca: z.number().min(0).max(1).optional(),
});

const UroFieldAuditadoNumericoSchema = z.object({
  valor:        z.number().nullable(),
  origem:       UroFieldOrigemSchema,
  ocrConfianca: z.number().min(0).max(1).optional(),
});

const ResultadosEsperadosSchema = z.object({
  urobilinogenio: UroValorCategoricoSchema.optional(),
  glicose:        UroValorCategoricoSchema.optional(),
  cetonas:        UroValorCategoricoSchema.optional(),
  bilirrubina:    UroValorCategoricoSchema.optional(),
  proteina:       UroValorCategoricoSchema.optional(),
  nitrito:        UroValorCategoricoSchema.optional(),
  sangue:         UroValorCategoricoSchema.optional(),
  leucocitos:     UroValorCategoricoSchema.optional(),
  ph:             z.object({ min: z.number(), max: z.number() }).optional(),
  densidade:      z.object({ min: z.number(), max: z.number() }).optional(),
});

const ResultadosSchema = z.object({
  urobilinogenio: UroFieldAuditadoCategoricoSchema.optional(),
  glicose:        UroFieldAuditadoCategoricoSchema.optional(),
  cetonas:        UroFieldAuditadoCategoricoSchema.optional(),
  bilirrubina:    UroFieldAuditadoCategoricoSchema.optional(),
  proteina:       UroFieldAuditadoCategoricoSchema.optional(),
  nitrito:        UroFieldAuditadoCategoricoSchema.optional(),
  sangue:         UroFieldAuditadoCategoricoSchema.optional(),
  leucocitos:     UroFieldAuditadoCategoricoSchema.optional(),
  ph:             UroFieldAuditadoNumericoSchema.optional(),
  densidade:      UroFieldAuditadoNumericoSchema.optional(),
});

export const UroanaliseFormSchema = z
  .object({
    // ── Identificação do nível e controle ─────────────────────────────────────
    nivel: z.enum(['N', 'P'], { required_error: 'Selecione o nível do controle.' }),
    frequencia: z.enum(['DIARIA', 'LOTE'], { required_error: 'Selecione a frequência.' }),

    // ── Controle ──────────────────────────────────────────────────────────────
    loteControle:       z.string().min(1, 'Lote do controle é obrigatório.'),
    fabricanteControle: z.string().min(1, 'Fabricante do controle é obrigatório.'),
    aberturaControle:   dateField('Data de abertura do controle inválida.'),
    validadeControle:   dateField('Data de validade do controle inválida.'),

    // ── Tiras reagentes ───────────────────────────────────────────────────────
    loteTira:        z.string().min(1, 'Lote das tiras é obrigatório.'),
    tiraMarca:       z.string().optional(),
    fabricanteTira:  z.string().optional(),
    validadeTira:    z.string().regex(DATE_REGEX, 'Validade da tira inválida (YYYY-MM-DD).').optional().or(z.literal('')),

    // ── Operador ──────────────────────────────────────────────────────────────
    operatorDocument: z.string().min(1, 'Documento profissional obrigatório.'),
    operatorName:     z.string().optional(),
    cargo: z.enum(
      ['biomedico', 'tecnico', 'farmaceutico'],
      { required_error: 'Selecione o cargo do operador.' },
    ),

    // ── Ambiente ──────────────────────────────────────────────────────────────
    temperaturaAmbiente: z.coerce.number().optional(),
    umidadeAmbiente:     z.coerce.number().min(0).max(100).optional(),

    // ── Data ──────────────────────────────────────────────────────────────────
    dataRealizacao: dateField('Data de realização inválida.'),

    // ── Resultados ────────────────────────────────────────────────────────────
    /** Resultados obtidos por analito — cada campo é UroFieldAuditado (com origem). */
    resultados: ResultadosSchema,

    /** Resultados esperados do material de controle (derivados do nível ou custom). */
    resultadosEsperadosRun: ResultadosEsperadosSchema,

    // ── Ação corretiva ────────────────────────────────────────────────────────
    acaoCorretiva: z.string().optional(),

    // ── Tecnovigilância (RDC 67/2009 + 551/2021) ──────────────────────────────
    notivisaTipo:          z.enum(['queixa_tecnica', 'evento_adverso']).optional(),
    notivisaStatus:        z.enum(['pendente', 'notificado', 'dispensado']).optional(),
    notivisaProtocolo:     z.string().optional(),
    notivisaDataEnvio:     z.string().regex(DATE_REGEX, 'Data de envio inválida.').optional().or(z.literal('')),
    notivisaJustificativa: z.string().optional(),
  })
  .refine((d) => d.dataRealizacao <= d.validadeControle, {
    message: 'Data de realização posterior à validade do controle.',
    path:    ['dataRealizacao'],
  })
  .refine((d) => d.aberturaControle <= d.dataRealizacao, {
    message: 'Data de abertura do controle não pode ser posterior à realização.',
    path:    ['aberturaControle'],
  })
  .refine(
    (d) => !d.validadeTira || d.dataRealizacao <= d.validadeTira,
    {
      message: 'Data de realização posterior à validade da tira.',
      path:    ['validadeTira'],
    },
  )
  .refine(
    (d) => d.notivisaStatus !== 'notificado' || Boolean(d.notivisaProtocolo?.trim()),
    {
      message: 'Protocolo do NOTIVISA é obrigatório quando status = notificado.',
      path:    ['notivisaProtocolo'],
    },
  )
  .refine(
    (d) => d.notivisaStatus !== 'notificado' || Boolean(d.notivisaDataEnvio?.trim()),
    {
      message: 'Data de envio é obrigatória quando status = notificado.',
      path:    ['notivisaDataEnvio'],
    },
  )
  .refine(
    (d) => d.notivisaStatus !== 'dispensado' || Boolean(d.notivisaJustificativa?.trim()),
    {
      message: 'Justificativa é obrigatória quando a notificação é dispensada.',
      path:    ['notivisaJustificativa'],
    },
  );

export type UroanaliseFormData = z.infer<typeof UroanaliseFormSchema>;
