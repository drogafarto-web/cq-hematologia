/**
 * notivisa/http/payloadBuilder.ts — Transform laudo → NOTIVISA payload
 *
 * Wave 3 Agent 3 — Maps HC Quality result data to government schema
 *
 * Validates all required fields and returns a Zod-checked payload
 * ready for government submission.
 */

import { z } from 'zod';
import { writeAuditLog } from '../../../shared/audit/writeAuditLog';

export interface LaudoDoc {
  id: string;
  labId: string;
  pacienteId: string;
  pacienteCpf: string;
  pacienteNome: string;
  resultadoEm: number;
  resultados: Array<{
    analito: string;
    valor: string | number;
    unidade: string;
    referencia: string;
  }>;
  assinatura: {
    operatorId: string;
    operatorCpf: string;
    operatorNome: string;
    ts: number;
  };
  deletadoEm?: number | null;
}

export interface LabDoc {
  id: string;
  nome: string;
}

// Zod schema for NOTIVISA payload validation
const notivisaPayloadSchema = z.object({
  versao: z.literal('1.0'),
  laudo_id: z.string().min(1, 'laudo_id required'),
  paciente_cpf: z.string().regex(/^\d{11}$/, 'Invalid CPF format'),
  data_resultado: z.number().int().positive('Invalid timestamp'),
  resultados: z
    .array(
      z.object({
        analito: z.string().min(1),
        valor: z.union([z.number(), z.string()]),
        unidade: z.string().min(1),
        referencia: z.string(),
      }),
    )
    .min(1, 'At least one result required'),
  assinador: z.object({
    cpf: z.string().regex(/^\d{11}$/, 'Invalid operator CPF'),
    nome: z.string().min(1),
    data_assinatura: z.number().int().positive('Invalid signature timestamp'),
  }),
});

export type NotivisaPayload = z.infer<typeof notivisaPayloadSchema>;

/**
 * Build a NOTIVISA payload from laudo + lab data
 *
 * Validates all required fields before returning. On validation failure,
 * logs the error and throws (caller responsibility to handle).
 *
 * @throws Error if validation fails
 */
export async function buildNotivisaPayload(laudo: LaudoDoc, lab: LabDoc): Promise<NotivisaPayload> {
  // Validation checks
  if (laudo.deletadoEm) {
    throw new Error('Cannot submit deleted laudo');
  }

  if (!laudo.pacienteCpf || !/^\d{11}$/.test(laudo.pacienteCpf)) {
    throw new Error('Invalid paciente CPF');
  }

  if (!laudo.assinatura?.operatorCpf || !/^\d{11}$/.test(laudo.assinatura.operatorCpf)) {
    throw new Error('Invalid operator CPF');
  }

  if (!laudo.resultados || laudo.resultados.length === 0) {
    throw new Error('Laudo must contain at least one result');
  }

  // Build payload
  const payload = {
    versao: '1.0' as const,
    laudo_id: laudo.id,
    paciente_cpf: laudo.pacienteCpf,
    data_resultado: laudo.resultadoEm,
    resultados: laudo.resultados.map((r) => ({
      analito: r.analito,
      valor: r.valor,
      unidade: r.unidade,
      referencia: r.referencia,
    })),
    assinador: {
      cpf: laudo.assinatura.operatorCpf,
      nome: laudo.assinatura.operatorNome || 'UNKNOWN',
      data_assinatura: laudo.assinatura.ts,
    },
  };

  // Validate against schema
  const validated = notivisaPayloadSchema.parse(payload);

  // Log success
  await writeAuditLog({
    action: 'NOTIVISA_PAYLOAD_CREATED',
    labId: laudo.labId,
    payload: {
      laudoId: laudo.id,
      pacienteCpfMasked: `***${laudo.pacienteCpf.slice(-4)}`,
      resultadosCount: laudo.resultados.length,
    },
  });

  return validated;
}

/**
 * Validate an existing NOTIVISA payload against schema
 *
 * @throws Error if validation fails
 */
export function validateNotivisaPayload(data: unknown): NotivisaPayload {
  return notivisaPayloadSchema.parse(data);
}
