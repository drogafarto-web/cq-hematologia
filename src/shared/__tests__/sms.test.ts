import { describe, it, expect } from 'vitest';
import { smsTemplate } from '../sms';

describe('sms.ts', () => {
  const validCritico = {
    analito: 'Potássio',
    valor: 7.5,
    referencia: '3.5-5.0',
  };

  const validLab = {
    nomeAbreviado: 'Lab XYZ',
    telefone: '(11) 99999-9999',
    email: 'lab@example.com',
  };

  const validPaciente = {
    name: 'Maria dos Santos',
  };

  it('should generate SMS message with all required fields', () => {
    const result = smsTemplate(validCritico, validLab, validPaciente);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result).toContain('ALERTA');
    expect(result).toContain('Maria dos Santos');
    expect(result).toContain('POTÁSSIO');
    expect(result).toContain('7.5');
    expect(result).toContain('3.5-5.0');
  });

  it('should keep message under 160 characters', () => {
    const result = smsTemplate(validCritico, validLab, validPaciente);

    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('should truncate patient name to 20 characters', () => {
    const longNamePaciente = {
      name: 'Maria dos Santos Silva da Costa Oliveira',
    };

    const result = smsTemplate(validCritico, validLab, longNamePaciente);

    // Should truncate to 20 chars: 'Maria dos Santos Sil'
    expect(result).toContain('Maria dos Santos Sil');
  });

  it('should uppercase the analito name', () => {
    const result = smsTemplate(validCritico, validLab, validPaciente);

    expect(result).toContain('POTÁSSIO');
    expect(result).not.toContain('potássio');
  });

  it('should use email as fallback when phone is missing', () => {
    const labSemTelefone = {
      nomeAbreviado: 'Lab XYZ',
      email: 'lab@example.com',
    };

    const result = smsTemplate(validCritico, labSemTelefone, validPaciente);

    expect(result).toContain('lab@example.com');
    expect(result).not.toContain('(11)');
  });

  it('should handle missing paciente name', () => {
    const pacienteNoName = {};

    const result = smsTemplate(validCritico, validLab, pacienteNoName as any);

    expect(result).toContain('ALERTA');
    expect(result).toContain('Paciente');
    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('should use truncation marker when message exceeds 160 chars', () => {
    const longLabName = {
      nomeAbreviado: 'Laboratório com nome extremamente longo para teste de truncagem',
      telefone: '(11) 99999-9999',
      email: 'lab@example.com',
    };

    const result = smsTemplate(validCritico, longLabName, validPaciente);

    expect(result.length).toBeLessThanOrEqual(160);
  });

  it('should include contact information', () => {
    const result = smsTemplate(validCritico, validLab, validPaciente);

    expect(result).toContain('Contato:');
    expect(result).toContain('(11) 99999-9999');
  });

  it('should format numeric value correctly', () => {
    const criticoComDecimal = {
      analito: 'Glicose',
      valor: 125.5,
      referencia: '70-100',
    };

    const result = smsTemplate(criticoComDecimal, validLab, validPaciente);

    expect(result).toContain('125.5');
  });
});
