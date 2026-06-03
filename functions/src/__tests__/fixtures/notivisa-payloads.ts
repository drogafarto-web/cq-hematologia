/**
 * Test fixtures for NOTIVISA module
 */

import { type NotivisaPayload, type LaudoInput, type PacienteInput } from '../../shared/notivisa';

export const mockPaciente: PacienteInput = {
  cpf: '12345678901',
  nome: 'João da Silva',
};

export const mockLaudo: LaudoInput = {
  id: 'laudo-test-001',
  resultadoEm: 1714982400000, // 2024-05-06 00:00:00 UTC
  resultados: [
    {
      analito: 'Potassium',
      valor: '5.8',
      unidade: 'mEq/L',
      referencia: '3.5-5.5',
    },
    {
      analito: 'Sodium',
      valor: '138',
      unidade: 'mEq/L',
      referencia: '135-145',
    },
  ],
  assinatura: {
    operatorCpf: '98765432100',
    ts: 1714982400000,
  },
};

export const mockNotivisaPayload: NotivisaPayload = {
  versao: '1.0',
  laudo_id: 'laudo-test-001',
  paciente_cpf: '12345678901',
  data_resultado: 1714982400000,
  resultados: [
    {
      analito: 'Potassium',
      valor: '5.8',
      unidade: 'mEq/L',
      referencia: '3.5-5.5',
    },
    {
      analito: 'Sodium',
      valor: '138',
      unidade: 'mEq/L',
      referencia: '135-145',
    },
  ],
  assinador: {
    cpf: '98765432100',
    nome: 'João da Silva',
    data_assinatura: 1714982400000,
  },
};

export const mockLaudoMissingCPF: Partial<LaudoInput> = {
  id: 'laudo-test-002',
  resultadoEm: 1714982400000,
  resultados: [
    {
      analito: 'Glucose',
      valor: '180',
      unidade: 'mg/dL',
      referencia: '70-100',
    },
  ],
  assinatura: {
    operatorCpf: '98765432100',
    ts: 1714982400000,
  },
};

export const mockPacienteMissingCPF: Partial<PacienteInput> = {
  nome: 'Maria dos Santos',
};

export const mockLaudoEmptyResultados: LaudoInput = {
  id: 'laudo-test-003',
  resultadoEm: 1714982400000,
  resultados: [],
  assinatura: {
    operatorCpf: '98765432100',
    ts: 1714982400000,
  },
};
