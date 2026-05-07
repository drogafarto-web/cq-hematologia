/**
 * NOTIVISA Module Types
 * Phase 4 implementation pending
 */

import type { NotivisaPayload } from '../../shared/notivisa';

export type NotivisaEventStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'ACKNOWLEDGED'
  | 'REJECTED';

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
