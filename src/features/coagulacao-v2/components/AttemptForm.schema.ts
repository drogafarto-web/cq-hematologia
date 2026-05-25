import { z } from 'zod';

export const attemptFormSchema = z.object({
  controlOperacionalId: z.string().min(1, 'Selecione um controle'),
  resultados: z.object({
    atividadeProtrombinica: z.number().positive('Valor deve ser positivo'),
    rni: z.number().positive('Valor deve ser positivo'),
    ttpa: z.number().positive('Valor deve ser positivo'),
  }),
  acaoCorretiva: z.string().min(10, 'Mínimo 10 caracteres').optional().nullable(),
});

export type AttemptFormData = z.infer<typeof attemptFormSchema>;
