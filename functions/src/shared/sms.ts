/**
 * SMS Template for Critical Value Escalation
 * Generates SMS messages for critical lab result alerts
 */

export interface CriticoInput {
  analito: string;
  valor: string | number;
  referencia: string;
}

export interface LabInput {
  nomeAbreviado: string;
  telefone?: string;
  email?: string;
}

export interface PacienteInput {
  nome?: string;
  celular?: string;
}

/**
 * Generate SMS message for critical value alert
 * Max 160 characters for single SMS segment
 * Art. 17 signature format compliance
 *
 * @param critico Critical value data
 * @param lab Laboratory info
 * @param paciente Patient info
 * @returns SMS message (≤160 chars)
 */
export const smsTemplate = (
  critico: CriticoInput,
  lab: LabInput,
  paciente: PacienteInput,
): string => {
  // Truncate patient name to 20 chars if present
  const patientDisplay = paciente.nome ? paciente.nome.substring(0, 20) : 'Paciente';

  // Build base message
  const baseMessage = `ALERTA: Resultado crítico para ${patientDisplay}. ${critico.analito.toUpperCase()} = ${critico.valor} (ref: ${critico.referencia}). ${lab.nomeAbreviado}.`;

  // Try to fit contact info
  const contact = lab.telefone ? `Contato: ${lab.telefone}` : '';
  const fullMessage = contact ? `${baseMessage} ${contact}` : baseMessage;

  // SMS max 160 chars - truncate if needed
  if (fullMessage.length <= 160) {
    return fullMessage;
  }

  // Fallback: message without phone (still within limit)
  if (baseMessage.length <= 160) {
    return baseMessage;
  }

  // Last resort: minimal message
  return `ALERTA CRÍTICO: ${critico.analito.toUpperCase()} = ${critico.valor}. Lab ${lab.nomeAbreviado}.`;
};

/**
 * Validate SMS length compliance
 */
export const validateSmsLength = (message: string, maxLength: number = 160): boolean => {
  return message.length <= maxLength;
};

/**
 * Generate email subject for critical value escalation
 */
export const emailSubjectCritico = (analito: string, lab: LabInput): string => {
  return `CRÍTICO: ${analito.toUpperCase()} - ${lab.nomeAbreviado}`;
};

/**
 * Generate email body for critical value escalation
 */
export const emailBodyCritico = (
  critico: CriticoInput,
  lab: LabInput,
  paciente: PacienteInput,
  timestamp: Date = new Date(),
): string => {
  return `
Resultado Crítico Detectado

Laboratório: ${lab.nomeAbreviado}
Data/Hora: ${timestamp.toLocaleString('pt-BR')}

Analito: ${critico.analito}
Valor: ${critico.valor}
Referência: ${critico.referencia}

Paciente: ${paciente.nome || 'N/A'}

Este é um alerta automático. Ação imediata recomendada.
  `.trim();
};
