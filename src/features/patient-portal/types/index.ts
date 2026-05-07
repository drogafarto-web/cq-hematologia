import { Timestamp } from 'firebase/firestore';

/**
 * Patient Portal Types
 *
 * RDC 978 Art. 167: 14 campos obrigatórios em laudo
 * DICQ 5.7.x: Resultado ao paciente (legible format)
 * DICQ 5.2.3: Acesso a informações do paciente
 */

export interface PatientPortalLaudo {
  id: string;
  labId: string;
  pacienteId: string;

  // RDC 978 Art. 167 — 14 campos
  nome: string; // Exam name
  dataColeta: Timestamp;
  dataResultado: Timestamp;
  dataEmissao: Timestamp;

  // Status
  status: 'FINALIZADO' | 'PENDENTE' | 'CANCELADO' | 'EM_ANALISE';
  criticoFlag: boolean;

  // For patient display (simplified vs. lab version)
  exames: Array<{
    nome: string;
    valor: string | number;
    unidade: string;
    valoresReferencia: string;
    analito: string;
  }>;

  // Metadata
  rtNome?: string;
  labName?: string;
  medicoSolicitanteName?: string;

  // Audit
  criadoEm: Timestamp;
  versionId?: string;
  signatureHash?: string; // For QR validation
}

export interface PatientAuthToken {
  token: string;
  patientId: string;
  labId: string;
  expiresAt: number; // Unix timestamp (ms)
}

export interface PatientSessionState {
  token: string | null;
  patientId: string | null;
  labId: string | null;
  expiresAt: number | null;
  isExpired: boolean;
  remainingMs: number;
}

export interface LaudoFilterState {
  dateRange: 'all' | '30d' | '60d' | '90d' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  sortBy: 'date-newest' | 'date-oldest' | 'exam-name';
  pageSize: number;
  currentPage: number;
}
