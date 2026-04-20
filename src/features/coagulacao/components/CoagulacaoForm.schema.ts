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
const dateField = (msg = 'Formato inválido (YYYY-MM-DD)') => z.string().regex(DATE_REGEX, msg);

const analytesBaseline = z.object({
  atividadeProtrombinica: z.coerce.number().positive(),
  rni: z.coerce.number().positive(),
  ttpa: z.coerce.number().positive(),
});

export const CoagulacaoFormSchema = z
  .object({
    // ── Identificação ──────────────────────────────────────────────────────────
    nivel: z.enum(['I', 'II'], { required_error: 'Selecione o nível do controle.' }),
    frequencia: z.enum(['DIARIA', 'LOTE'], { required_error: 'Selecione a frequência.' }),
    equipamento: z.literal('Clotimer Duo'),

    // ── Controle ───────────────────────────────────────────────────────────────
    loteControle: z.string().min(1, 'Lote do controle é obrigatório.'),
    fabricanteControle: z.string().min(1, 'Fabricante do controle é obrigatório.'),
    aberturaControle: dateField('Data de abertura do controle inválida.'),
    validadeControle: dateField('Data de validade do controle inválida.'),

    // ── Reagente ───────────────────────────────────────────────────────────────
    loteReagente: z.string().min(1, 'Lote do reagente é obrigatório.'),
    fabricanteReagente: z.string().min(1, 'Fabricante do reagente é obrigatório.'),
    aberturaReagente: dateField('Data de abertura do reagente inválida.'),
    validadeReagente: dateField('Data de validade do reagente inválida.'),

    // ── Calibração INR (opcionais) ─────────────────────────────────────────────
    isi: z.coerce.number().positive('ISI deve ser positivo.').optional(),
    mnpt: z.coerce.number().positive('MNPT deve ser positivo.').optional(),

    // ── Operador ──────────────────────────────────────────────────────────────
    operatorDocument: z.string().min(1, 'Documento profissional obrigatório (ex: CRBM-MG 12345).'),
    operatorName: z.string().optional(),
    cargo: z.enum(['biomedico', 'tecnico', 'farmaceutico'], {
      required_error: 'Selecione o cargo do operador.',
    }),

    // ── Ambiente ──────────────────────────────────────────────────────────────
    temperaturaAmbiente: z.coerce.number().optional(),
    umidadeAmbiente: z.coerce
      .number()
      .min(0, 'Umidade inválida.')
      .max(100, 'Umidade inválida.')
      .optional(),

    // ── Resultados (sempre os 3 analitos — Clotimer Duo mede TP + TTPA) ────────
    resultados: analytesBaseline,

    // ── Alvos opcionais (mean/SD do fabricante — sobrescreve default COAG_ANALYTES) ──
    /** Se fornecidos, devem conter os 3 analitos completos (ou omitir tudo para usar default). */
    mean: analytesBaseline.optional(),
    sd: analytesBaseline.optional(),

    // ── Data de realização ─────────────────────────────────────────────────────
    dataRealizacao: dateField('Data de realização inválida.'),

    // ── Ação corretiva ─────────────────────────────────────────────────────────
    /**
     * Obrigatória quando a conformidade da corrida é 'R' (Rejeitada).
     * A verificação é feita em runtime pelo formulário (depende do contexto
     * Westgard com todas as runs anteriores do lote) — não validada no schema.
     */
    acaoCorretiva: z.string().optional(),

    // ── Notificação sanitária (RDC 67/2009 + 551/2021) ─────────────────────────
    notivisaTipo: z.enum(['queixa_tecnica', 'evento_adverso']).optional(),
    notivisaStatus: z.enum(['pendente', 'notificado', 'dispensado']).optional(),
    notivisaProtocolo: z.string().optional(),
    notivisaDataEnvio: z
      .string()
      .regex(DATE_REGEX, 'Data de envio inválida (YYYY-MM-DD).')
      .optional()
      .or(z.literal('')),
    notivisaJustificativa: z.string().optional(),
  })
  // Regra RDC 978: realização não pode ser após a validade do controle
  .refine((d) => d.dataRealizacao <= d.validadeControle, {
    message: 'Data de realização posterior à validade do controle.',
    path: ['dataRealizacao'],
  })
  // Regra RDC 978: realização não pode ser após a validade do reagente
  .refine((d) => d.dataRealizacao <= d.validadeReagente, {
    message: 'Data de realização posterior à validade do reagente.',
    path: ['dataRealizacao'],
  })
  // Abertura do controle não pode ser futura
  .refine((d) => d.aberturaControle <= d.dataRealizacao, {
    message: 'Data de abertura do controle não pode ser posterior à realização.',
    path: ['aberturaControle'],
  })
  // Abertura do reagente não pode ser futura
  .refine((d) => d.aberturaReagente <= d.dataRealizacao, {
    message: 'Data de abertura do reagente não pode ser posterior à realização.',
    path: ['aberturaReagente'],
  })
  // Se status NOTIVISA = 'notificado' → protocolo e data de envio obrigatórios
  .refine((d) => d.notivisaStatus !== 'notificado' || Boolean(d.notivisaProtocolo?.trim()), {
    message: 'Protocolo do NOTIVISA é obrigatório quando status = notificado.',
    path: ['notivisaProtocolo'],
  })
  .refine((d) => d.notivisaStatus !== 'notificado' || Boolean(d.notivisaDataEnvio?.trim()), {
    message: 'Data de envio é obrigatória quando status = notificado.',
    path: ['notivisaDataEnvio'],
  })
  // Se status = 'dispensado' → justificativa obrigatória (auditoria)
  .refine((d) => d.notivisaStatus !== 'dispensado' || Boolean(d.notivisaJustificativa?.trim()), {
    message: 'Justificativa é obrigatória quando a notificação é dispensada.',
    path: ['notivisaJustificativa'],
  });

export type CoagulacaoFormData = z.infer<typeof CoagulacaoFormSchema>;
