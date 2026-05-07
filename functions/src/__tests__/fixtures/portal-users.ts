/**
 * Test fixtures for Portal module
 */

export interface MockPatient {
  uid: string;
  email: string;
  role: string;
  labId: string;
  name?: string;
  cpf?: string;
}

export interface MockPortalConfig {
  labId: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  enabled: boolean;
  locale?: string;
  custom_html?: string;
}

export const mockPatient: MockPatient = {
  uid: 'patient-123',
  email: 'patient@example.com',
  role: 'PATIENT',
  labId: 'test-lab-001',
  name: 'João Silva',
  cpf: '12345678901'
};

export const mockPatient2: MockPatient = {
  uid: 'patient-456',
  email: 'maria@example.com',
  role: 'PATIENT',
  labId: 'test-lab-001',
  name: 'Maria Santos',
  cpf: '98765432100'
};

export const mockPortalConfigBasic: MockPortalConfig = {
  labId: 'test-lab-001',
  enabled: true,
  logo_url: 'https://example.com/logo.png',
  primary_color: '#1A202C',
  secondary_color: '#6366F1'
};

export const mockPortalConfigFull: MockPortalConfig = {
  labId: 'test-lab-001',
  enabled: true,
  logo_url: 'https://example.com/logo.png',
  primary_color: '#1A202C',
  secondary_color: '#6366F1',
  locale: 'pt-BR',
  custom_html: '<footer>© 2024 Healthcare Lab</footer>'
};

export const mockPortalConfigDisabled: MockPortalConfig = {
  labId: 'test-lab-002',
  enabled: false
};

export const mockLaudoForPatient = {
  id: 'laudo-patient-001',
  pacienteId: 'patient-123',
  labId: 'test-lab-001',
  dataSolicitacao: 1714982400000,
  dataResultado: 1714982400000,
  status: 'FINALIZADO',
  resultados: [
    {
      analito: 'Hemoglobin',
      valor: '14.5',
      unidade: 'g/dL',
      referencia: '13.0-17.5'
    }
  ],
  assinatura: {
    operatorId: 'rt-001',
    ts: 1714982400000,
    hash: 'abc123'
  }
};

export const mockDownloadRequest = {
  laudoId: 'laudo-patient-001',
  format: 'PDF',
  includeSignature: true
};
