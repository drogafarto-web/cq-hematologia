/**
 * Portal Module Types
 * Phase 5-6 implementation pending
 */

export interface PortalConfig {
  labId: string;
  enabled: boolean;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  locale?: string;
  custom_html?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PatientLaudo {
  id: string;
  pacienteId: string;
  labId: string;
  dataSolicitacao: number;
  dataResultado: number;
  status: 'FINALIZADO' | 'PENDENTE' | 'CANCELADO';
  resultados: Array<{
    analito: string;
    valor: string | number;
    unidade: string;
    referencia: string;
  }>;
  assinatura: {
    operatorId: string;
    ts: number;
    hash: string;
  };
}

export interface PortalAccessRequest {
  patientUid: string;
  labId: string;
}

export interface PortalAccessResponse {
  access_granted: boolean;
  config?: PortalConfig;
  message: string;
}

export interface LaudoDownloadRequest {
  laudoId: string;
  format: 'PDF' | 'JSON';
  includeSignature: boolean;
}

export interface LaudoDownloadResponse {
  status: string;
  downloadUrl?: string;
  message: string;
}
