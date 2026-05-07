/**
 * Críticos (Critical Values) Module Types
 * Phase 7 implementation pending
 */

export interface Critico {
  id: string;
  labId: string;
  analito: string;
  limite_inferior: number;
  limite_superior: number;
  sms_escalation: boolean;
  email_escalation: boolean;
  phone_escalation?: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CriticalValueAlert {
  id: string;
  labId: string;
  pacienteId: string;
  laudoId: string;
  analito: string;
  valor: number;
  referencia: string;
  tipo: 'ALTO' | 'BAIXO';
  status: 'PENDING' | 'NOTIFIED' | 'ESCALATED' | 'RESOLVED';
  recipients: Array<{
    type: 'SMS' | 'EMAIL' | 'PHONE';
    value: string;
  }>;
  attempts: number;
  lastAttempt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EscalationConfig {
  labId: string;
  rtUid?: string;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recipients: Array<{
    type: 'SMS' | 'EMAIL' | 'PHONE';
    value: string;
  }>;
  maxRetries: number;
  retryIntervalMs: number;
  timeout?: number;
}

export interface CriticalValueRequest {
  labId: string;
  pacienteId: string;
  laudoId: string;
  analito: string;
  valor: number;
  referencia: string;
}

export interface CriticalValueResponse {
  status: string;
  alertId?: string;
  message: string;
  escalated?: boolean;
}
