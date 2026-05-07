/**
 * NOTIVISA Formatter - Art. 6º §1 NOTIVISA schema compliance
 * Transforms HC Quality laudo data into NOTIVISA notification format
 */

import { z } from 'zod';

export const notivisaPayloadSchema = z.object({
  versao: z.literal('1.0'),
  laudo_id: z.string().min(1, 'laudo_id required'),
  paciente_cpf: z.string().regex(/^\d{11}$/, 'Invalid CPF format'),
  data_resultado: z.number().int().positive('Invalid timestamp'),
  resultados: z.array(
    z.object({
      analito: z.string().min(1),
      valor: z.union([z.number(), z.string()]),
      unidade: z.string().min(1),
      referencia: z.string()
    })
  ),
  assinador: z.object({
    cpf: z.string().regex(/^\d{11}$/, 'Invalid operator CPF'),
    nome: z.string().min(1),
    data_assinatura: z.number().int().positive()
  })
});

export type NotivisaPayload = z.infer<typeof notivisaPayloadSchema>;

export interface LaudoInput {
  id: string;
  resultadoEm: number;
  resultados: Array<{
    analito: string;
    valor: string | number;
    unidade: string;
    referencia: string;
  }>;
  assinatura: {
    operatorCpf: string;
    ts: number;
  };
}

export interface PacienteInput {
  cpf: string;
  nome: string;
}

/**
 * Format laudo data per NOTIVISA Art. 6º §1 schema
 * Validates required fields and transforms structure
 */
export const notivisaFormatter = (laudo: LaudoInput, paciente: PacienteInput): NotivisaPayload => {
  if (!paciente.cpf) {
    throw new Error('Paciente CPF is required for NOTIVISA notification');
  }

  if (!laudo.resultados || laudo.resultados.length === 0) {
    throw new Error('Laudo must contain at least one resultado');
  }

  if (!laudo.assinatura?.operatorCpf) {
    throw new Error('Assinatura operatorCpf is required');
  }

  const payload: NotivisaPayload = {
    versao: '1.0',
    laudo_id: laudo.id,
    paciente_cpf: paciente.cpf,
    data_resultado: laudo.resultadoEm,
    resultados: laudo.resultados.map(r => ({
      analito: r.analito,
      valor: r.valor,
      unidade: r.unidade,
      referencia: r.referencia
    })),
    assinador: {
      cpf: laudo.assinatura.operatorCpf,
      nome: paciente.nome,
      data_assinatura: laudo.assinatura.ts
    }
  };

  // Validate against schema
  return notivisaPayloadSchema.parse(payload);
};

/**
 * Validate existing NOTIVISA payload
 */
export const validateNotivisaPayload = (data: unknown): NotivisaPayload => {
  return notivisaPayloadSchema.parse(data);
};
