/**
 * Patient Portal Types
 * RDC 978 Arts. 167 + DICQ 5.2, 5.3, 5.7
 */

import { Timestamp } from 'firebase/firestore';

// Canonical form for UI layer
export interface PatientPortalLaudo {
  id: string;
  labId: string;
  pacienteId: string;
  nome: string; // Exam name
  dataColeta: Timestamp;
  dataResultado: Timestamp;
  dataEmissao: Timestamp;
  status: 'FINALIZADO' | 'PENDENTE' | 'CANCELADO' | 'EM_ANALISE';
  criticoFlag: boolean;
  exames: Array<{
    nome: string;
    valor: string | number;
    unidade: string;
    valoresReferencia: string;
    analito: string;
  }>;
  rtNome?: string;
  labName?: string;
  medicoSolicitanteName?: string;
  criadoEm: Timestamp;
  versionId?: string;
  signatureHash?: string;
}

export interface PatientAuthToken {
  patientId: string;
  labId: string;
  email: string;
  expiresAt: number; // Unix timestamp in milliseconds
  iat: number; // Issued at
  signature: string;
}

export interface PatientSession {
  token: string;
  patientId: string;
  labId: string;
  email: string;
  expiresAt: Date;
}

export interface PatientSessionState {
  token: string | null;
  patientId: string | null;
  labId: string | null;
  expiresAt: number | null;
  isExpired: boolean;
  remainingMs: number;
}

export interface PatientInfo {
  id: string;
  labId: string;
  name: string;
  dateOfBirth: Date;
  email: string;
  identifiers?: {
    labPatientId?: string;
    mrn?: string;
    lisId?: string;
  };
  status: 'active' | 'inactive';
}

export interface PatientLaudo {
  id: string;
  laudoId: string;
  patientId: string;
  labId: string;
  exameName: string;
  examDate: Date;
  releaseDate?: Date;
  status: 'ready' | 'pending' | 'blocked';
  versionId: string;
  signatureHash?: string;
  expiresAt: Date; // 90 days from analysis date
  materialType?: string;
  analyticMethod?: string;
}

export interface LaudoFilterState {
  dateRange: 'all' | '30d' | '60d' | '90d' | 'custom';
  customStartDate?: Date;
  customEndDate?: Date;
  sortBy: 'date-newest' | 'date-oldest' | 'exam-name';
  pageSize: number;
  currentPage: number;
}

export interface PatientFeedback {
  id: string;
  patientId: string;
  laudoId: string;
  labId: string;
  npsScore: number; // 0-10
  satisfaction?: 'very_poor' | 'poor' | 'neutral' | 'good' | 'very_good';
  comment?: string;
  createdAt: Date;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    timeOnPortal?: number; // seconds
  };
}

export interface PatientAuthEvent {
  id: string;
  patientId: string;
  labId: string;
  action: 'LINK_GENERATED' | 'TOKEN_VERIFIED' | 'LINK_EXPIRED' | 'AUTH_FAILED';
  createdAt: Date;
  ipAddress?: string; // anonymized
  userAgent?: string;
  errorMessage?: string;
}

export interface PortalAuthResponse {
  success: boolean;
  token?: string;
  patientId?: string;
  labId?: string;
  expiresIn?: number; // seconds
  error?: string;
}

export interface GenerateAuthLinkRequest {
  email: string;
  labId: string;
}

export interface GenerateAuthLinkResponse {
  success: boolean;
  message: string;
  expiresInHours?: number;
  error?: string;
}

export interface VerifyAuthTokenRequest {
  token: string;
  labId: string;
}

export interface VerifyAuthTokenResponse {
  valid: boolean;
  patientId?: string;
  labId?: string;
  expiresAt?: number;
  error?: string;
}
