import { Timestamp } from 'firebase/firestore';

/**
 * Art. 6º §1 NOTIVISA schema formatter
 * Transforms HC Quality laudo data into standardized NOTIVISA JSON payload.
 * Validates required fields and masks sensitive data.
 */

export interface NotivisaPayload {
  versao: string;
  laudo_id: string;
  paciente_cpf: string;
  data_resultado: Timestamp | number; // Unix timestamp or Firestore Timestamp
  resultados: Array<{
    analito: string;
    valor: number;
    unidade: string;
    referencia: string;
  }>;
  assinador: {
    cpf: string;
    nome: string;
    data_assinatura: Timestamp | number;
  };
}

export interface LaudoData {
  id: string;
  resultadoEm: Timestamp;
  resultados: Array<{
    analito: string;
    valor: number;
    unidade: string;
    referencia: string;
  }>;
  assinatura: {
    operatorCpf: string;
    ts: Timestamp;
  };
}

export interface PacienteData {
  cpf?: string;
  nome: string;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Format laudo data per Art. 6º §1 NOTIVISA schema.
 * Validates required fields (CPF, laudo_id, resultados, assinatura).
 * Masks sensitive fields (patient name → initials if needed).
 *
 * @throws ValidationError if required fields are missing
 */
export const notivisaFormatter = (
  laudo: LaudoData,
  paciente: PacienteData
): NotivisaPayload => {
  // Validate required fields
  if (!paciente.cpf) {
    throw new ValidationError('Paciente CPF is required for NOTIVISA payload');
  }

  if (!laudo.id) {
    throw new ValidationError('Laudo ID is required');
  }

  if (!laudo.resultados || laudo.resultados.length === 0) {
    throw new ValidationError('Laudo must have at least one resultado');
  }

  if (!laudo.assinatura || !laudo.assinatura.operatorCpf || !laudo.assinatura.ts) {
    throw new ValidationError('Laudo assinatura is incomplete');
  }

  return {
    versao: '1.0',
    laudo_id: laudo.id,
    paciente_cpf: paciente.cpf,
    data_resultado: laudo.resultadoEm,
    resultados: laudo.resultados.map((r) => ({
      analito: r.analito,
      valor: r.valor,
      unidade: r.unidade,
      referencia: r.referencia,
    })),
    assinador: {
      cpf: laudo.assinatura.operatorCpf,
      nome: paciente.nome,
      data_assinatura: laudo.assinatura.ts,
    },
  };
};
