/**
 * SMS template for critical value escalation.
 * Generates concise SMS message (≤160 chars for SMS compatibility).
 * Art. 17 signature format and professional tone.
 */

export interface CriticoData {
  analito: string;
  valor: number;
  referencia: string;
}

export interface LabData {
  nomeAbreviado: string;
  telefone?: string;
  email?: string;
}

export interface PacienteData {
  name?: string;
  nome?: string;
}

/**
 * Generate SMS message for critical value alert.
 * Message respects SMS 160-char limit.
 * Name truncated to first 20 chars; phone fallback to email.
 *
 * @param critico - Critical value data
 * @param lab - Lab information
 * @param paciente - Patient information
 * @returns SMS message string (≤160 chars)
 */
export const smsTemplate = (critico: CriticoData, lab: LabData, paciente: PacienteData): string => {
  const pacienteName = paciente.name || 'Paciente';
  const namePrefix = pacienteName.substring(0, 20);
  const analyteUpper = critico.analito.toUpperCase();
  const contact = lab.telefone || lab.email || 'Contato indisponível';

  const message = `ALERTA: Resultado crítico para ${namePrefix}. ${analyteUpper} = ${critico.valor} (ref: ${critico.referencia}). Lab ${lab.nomeAbreviado}. Contato: ${contact}.`;

  // Enforce SMS limit (160 chars)
  if (message.length > 160) {
    // If message exceeds limit, shorten components
    return message.substring(0, 157) + '...';
  }

  return message;
};
