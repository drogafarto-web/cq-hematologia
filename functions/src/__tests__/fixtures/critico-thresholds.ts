/**
 * Test fixtures for Críticos (Critical Values) module
 */

export interface MockCriticoConfig {
  analito: string;
  limite_inferior: number;
  limite_superior: number;
  sms_escalation: boolean;
  email_escalation: boolean;
  phone?: string;
  email?: string;
}

export interface MockCriticoAlert {
  id: string;
  labId: string;
  pacienteId: string;
  analito: string;
  valor: number;
  referencia: string;
  status: string;
  criadoEm: number;
}

export const mockCriticoConfigPotassium: MockCriticoConfig = {
  analito: 'potassium',
  limite_inferior: 3.5,
  limite_superior: 5.5,
  sms_escalation: true,
  email_escalation: true,
  phone: '+55 11 98765-4321',
  email: 'clinico@lab.com'
};

export const mockCriticoConfigGlucose: MockCriticoConfig = {
  analito: 'glucose',
  limite_inferior: 50,
  limite_superior: 400,
  sms_escalation: true,
  email_escalation: true,
  phone: '+55 11 99999-9999',
  email: 'manager@lab.com'
};

export const mockCriticoConfigCalcium: MockCriticoConfig = {
  analito: 'calcium',
  limite_inferior: 6.5,
  limite_superior: 10.5,
  sms_escalation: false,
  email_escalation: true,
  email: 'admin@lab.com'
};

export const mockCriticoAlert: MockCriticoAlert = {
  id: 'alert-001',
  labId: 'test-lab-001',
  pacienteId: 'patient-123',
  analito: 'potassium',
  valor: 6.2,
  referencia: '3.5-5.5',
  status: 'PENDING',
  criadoEm: 1714982400000
};

export const mockCriticoAlertHigh: MockCriticoAlert = {
  id: 'alert-002',
  labId: 'test-lab-001',
  pacienteId: 'patient-456',
  analito: 'glucose',
  valor: 450,
  referencia: '70-100',
  status: 'NOTIFIED',
  criadoEm: 1714982400000
};

export const mockCriticoAlertLow: MockCriticoAlert = {
  id: 'alert-003',
  labId: 'test-lab-001',
  pacienteId: 'patient-789',
  analito: 'calcium',
  valor: 5.5,
  referencia: '6.5-10.5',
  status: 'ESCALATED',
  criadoEm: 1714982400000
};

export const mockEscalationConfig = {
  labId: 'test-lab-001',
  rtUid: 'rt-001',
  urgencyLevel: 'CRITICAL',
  recipients: [
    { type: 'SMS', value: '+55 11 98765-4321' },
    { type: 'EMAIL', value: 'clinico@lab.com' },
    { type: 'PHONE', value: '+55 11 98765-4321' }
  ],
  maxRetries: 3,
  retryIntervalMs: 5000
};
