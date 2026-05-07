import { describe, it, expect } from 'vitest';
import { notivisaFormatter, type NotivisaPayload } from '../notivisa';
import { Timestamp } from 'firebase/firestore';

describe('notivisa.ts', () => {
  const mockTimestamp = Timestamp.now();

  const validLaudo = {
    id: 'laudo-123',
    resultadoEm: mockTimestamp,
    resultados: [
      {
        analito: 'Glicose',
        valor: 125,
        unidade: 'mg/dL',
        referencia: '70-100',
      },
    ],
    assinatura: {
      operatorCpf: '123.456.789-00',
      ts: mockTimestamp,
    },
  };

  const validPaciente = {
    cpf: '987.654.321-11',
    nome: 'João Silva',
  };

  it('should format valid laudo to NOTIVISA payload', () => {
    const result = notivisaFormatter(validLaudo, validPaciente);

    expect(result).toBeDefined();
    expect(result.versao).toBe('1.0');
    expect(result.laudo_id).toBe('laudo-123');
    expect(result.paciente_cpf).toBe('987.654.321-11');
    expect(result.resultados).toHaveLength(1);
    expect(result.resultados[0].analito).toBe('Glicose');
    expect(result.resultados[0].valor).toBe(125);
  });

  it('should throw ValidationError when paciente CPF is missing', () => {
    const pacienteSemCPF = { nome: 'João Silva' };

    expect(() => {
      notivisaFormatter(validLaudo, pacienteSemCPF as any);
    }).toThrow('Paciente CPF is required for NOTIVISA payload');
  });

  it('should include assinador with operator CPF and timestamp', () => {
    const result = notivisaFormatter(validLaudo, validPaciente);

    expect(result.assinador).toBeDefined();
    expect(result.assinador.cpf).toBe('123.456.789-00');
    expect(result.assinador.nome).toBe('João Silva');
    expect(result.assinador.data_assinatura).toBeDefined();
  });

  it('should throw ValidationError when laudo.resultados is empty', () => {
    const laudoSemResultados = {
      ...validLaudo,
      resultados: [],
    };

    expect(() => {
      notivisaFormatter(laudoSemResultados, validPaciente);
    }).toThrow('Laudo must have at least one resultado');
  });

  it('should throw ValidationError when laudo.id is missing', () => {
    const laudoSemId = {
      ...validLaudo,
      id: '',
    };

    expect(() => {
      notivisaFormatter(laudoSemId, validPaciente);
    }).toThrow('Laudo ID is required');
  });

  it('should throw ValidationError when assinatura is incomplete', () => {
    const laudoSemAssinatura = {
      ...validLaudo,
      assinatura: {
        operatorCpf: '',
        ts: mockTimestamp,
      },
    };

    expect(() => {
      notivisaFormatter(laudoSemAssinatura, validPaciente);
    }).toThrow('Laudo assinatura is incomplete');
  });

  it('should preserve all resultado fields in payload', () => {
    const laudoComMultiplosResultados = {
      ...validLaudo,
      resultados: [
        {
          analito: 'Glicose',
          valor: 125,
          unidade: 'mg/dL',
          referencia: '70-100',
        },
        {
          analito: 'Hemoglobina',
          valor: 15.2,
          unidade: 'g/dL',
          referencia: '13.0-17.0',
        },
      ],
    };

    const result = notivisaFormatter(laudoComMultiplosResultados, validPaciente);

    expect(result.resultados).toHaveLength(2);
    expect(result.resultados[0].analito).toBe('Glicose');
    expect(result.resultados[1].analito).toBe('Hemoglobina');
    expect(result.resultados[0].valor).toBe(125);
    expect(result.resultados[1].valor).toBe(15.2);
  });
});
