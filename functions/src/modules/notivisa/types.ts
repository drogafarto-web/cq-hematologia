/**
 * NOTIVISA Module Types
 * Phase 4 + Wave 3 implementation
 */

import type { NotivisaPayload } from '../../shared/notivisa';

export type NotivisaEventStatus = 'PENDING' | 'SENT' | 'FAILED' | 'ACKNOWLEDGED' | 'REJECTED';

export interface NotivisaEvent {
  id: string;
  labId: string;
  laudoId: string;
  pacienteCpf: string;
  payload: NotivisaPayload;
  status: NotivisaEventStatus;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: number;
  nextRetry?: number;
  response?: {
    code: string;
    message: string;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface NotivisaConfig {
  labId: string;
  enabled: boolean;
  apiUrl: string;
  apiKey?: string;
  maxRetries: number;
  retryIntervalMs: number;
  batchSize: number;
  pollingIntervalMs: number;
}

export interface NotivisaQueueRequest {
  laudoId: string;
  labId: string;
}

export interface NotivisaQueueResponse {
  status: string;
  message: string;
  eventId?: string;
}

// Wave 3 HTTP Client types
export interface NotivisaDraftPayload {
  versao: string;
  laudo_id: string;
  paciente_cpf: string;
  data_resultado: number;
  resultados: Array<{
    analito: string;
    valor: string | number;
    unidade: string;
    referencia: string;
  }>;
  assinador: {
    cpf: string;
    nome: string;
    data_assinatura: number;
  };
}

export interface NotivisaStatusResponse {
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  reason?: string;
  updatedAt?: number;
}

export interface NotivisaApprovalResponse {
  approvalId: string;
  approvedAt: number;
  certificateUrl: string;
}
