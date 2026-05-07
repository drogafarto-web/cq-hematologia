/**
 * Críticos (Critical Values) Module Types
 * Phase 6: SMS + Email escalation, SLA tracking, NOTIVISA
 */

import type { Timestamp } from 'firebase-admin/firestore';

/** Escalation attempt (immutable array in CriticosEscalacao) */
export interface CriticosEscalacaoAttempt {
  canalId: string;
  canal: 'SMS' | 'EMAIL' | 'WEBHOOK';
  status: 'enviado' | 'entregue' | 'falha' | 'descartado';
  enviado_em: Timestamp;
  entregue_em?: Timestamp;
  motivo_falha?: string;
  provider_messageId?: string;
  tentativa_numero: number;
  operador_manual?: string;
}

/** Master log of critical value escalations */
export interface CriticosEscalacao {
  id: string;
  labId: string;
  laudoId: string;
  laudoVersion: number;
  exameId: string;
  analitoId: string;
  valorObtido: number;
  thresholdId: string;
  severidade: 'alta' | 'baixa';
  motivo: string;
  pacienteId: string;
  pacienteNome: string;
  pacienteIdade: number;
  pacienteSexo: 'M' | 'F' | 'NI';
  medicoId: string;
  medicoNome: string;
  medicoTelefone: string;
  medicoEmail: string;
  rtId: string;
  rtNome: string;
  rtEmail: string;
  escalacoes: CriticosEscalacaoAttempt[];
  status: 'enviado' | 'reconhecido' | 'cancelado';
  reconhecido_em?: Timestamp;
  reconhecido_por?: string;
  tempo_deteccao_ms?: number;
  tempo_sla_ms?: number;
  sla_status: 'em_prazo' | 'vencido' | 'nao_aplicavel';
  sla_minutos_target: number;
  notivisaDraftId?: string;
  criadoEm: Timestamp;
  criadoPor: string;
  atualizadoEm: Timestamp;
  atualizadoPor: string;
  deletadoEm: Timestamp | null;
}

/** Append-only audit log for critical escalations */
export interface CriticosLogEvento {
  id: string;
  labId: string;
  escalacaoId: string;
  laudoId: string;
  tipo:
    | 'sms_enviado'
    | 'sms_entregue'
    | 'sms_falha'
    | 'email_enviado'
    | 'email_entregue'
    | 'email_falha'
    | 'webhook_delivery_confirmed'
    | 'reconhecimento_manual'
    | 'sla_vencido_alerta'
    | 'escalacao_cancelada';
  detalhes: Record<string, string | number | boolean>;
  timestamp: Timestamp;
  operadorId: string;
  assinatura: {
    hash: string;
    operatorId: string;
    ts: Timestamp;
  };
  eventoAnteriorId?: string;
  deletadoEm: Timestamp | null;
}

/** Request to register critical detection */
export interface RegisterCriticoDetectionRequest {
  labId: string;
  laudoId: string;
  laudoVersion: number;
  exames: Array<{
    id: string;
    analitoId: string;
    valor: number;
    unidade: string;
  }>;
  criticos: Array<{
    exameId: string;
    analitoId: string;
    valor: number;
    severidade: 'alta' | 'baixa';
    motivo: string;
  }>;
  paciente: {
    id: string;
    nome: string;
    idade: number;
    sexo: 'M' | 'F' | 'NI';
  };
  medico: {
    id: string;
    nome: string;
    telefone: string;
    email: string;
  };
}

/** Response from critical detection registration */
export interface RegisterCriticoDetectionResponse {
  success: boolean;
  escalacaoId: string;
  escalacoes: Array<{
    canalId: string;
    canal: 'SMS' | 'EMAIL';
    status: 'enviado' | 'falha';
    providerMessageId?: string;
    errorCode?: string;
  }>;
  sla: {
    slaMinutosTarget: number;
    etaAckMs: number;
  };
  notivisaDraftId?: string;
}

/** Request to acknowledge escalation */
export interface AcknowledgeEscalacaoRequest {
  labId: string;
  escalacaoId: string;
  acknowledgedBy: string;
  method: 'portal_web' | 'webhook_twilio' | 'manual_rt';
  notas?: string;
}

/** Response from acknowledgment */
export interface AcknowledgeEscalacaoResponse {
  success: boolean;
  escalacaoId: string;
  status: 'reconhecido';
  tempoSlaMs: number;
  slaStatus: 'em_prazo' | 'vencido';
}

/** Cron trigger response */
export interface EscalacaoCriticosResponse {
  labsScanned: number;
  escalacoesPending: number;
  smsConfirmed: number;
  smsRetried: number;
  slaVencidos: number;
  errors: Array<{
    escalacaoId: string;
    error: string;
  }>;
}
