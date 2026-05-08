/**
 * Critical Values (Críticos) Module Types
 * Phase 6: SMS + Email escalation, SLA tracking, NOTIVISA drafts
 *
 * Implements RDC 978 Art. 128 (rastreabilidade) + DICQ 4.3
 */

import type { Timestamp } from 'firebase/firestore';

/** Critical value threshold configuration (per-lab, per-analyte) */
export interface CriticosThreshold {
  id: string;
  labId: string;

  analitoId: string;
  analitoNome: string;
  unidade: string;

  min: number | null;
  max: number | null;
  alwaysCritico?: boolean;
  neverCritico?: boolean;

  severidade: 'alta' | 'baixa';

  condicional?: {
    idadeMin?: number;
    idadeMax?: number;
    sexo?: 'M' | 'F';
  };

  ativo: boolean;
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm: Timestamp | null;
}

/** Escalation attempt (immutable array in CriticosEscalacao) */
export interface CriticosEscalacaoAttempt {
  canalId: string;
  canal: 'SMS' | 'EMAIL' | 'WEBHOOK' | 'PUSH';
  status: 'enviado' | 'entregue' | 'falha' | 'descartado';
  enviado_em: Timestamp;
  entregue_em?: Timestamp;
  motivo_falha?: string;
  provider_messageId?: string;
  tentativa_numero: number;
  operador_manual?: string;
  /** Tier (1, 2, 3) that triggered this attempt — Task 05-02 SLA escalation */
  tier?: 1 | 2 | 3;
  /** Recipient role contacted at this tier */
  destinatario?: 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO';
  /** Recipient identifier (uid or external email/phone) */
  destinatario_id?: string;
}

/**
 * Per-tier escalation record (Task 05-02)
 * Tracks the 3-tier SLA escalation lifecycle independent of channel attempts.
 *
 * Tier 1: 0–15min   → contact RT (Responsável Técnico)
 * Tier 2: 15–30min  → contact attending physician
 * Tier 3: 30–60min  → escalate to CTO / Diretor Médico
 *
 * RDC 978 Art. 5.7.1: critical communication mandatory <60 min.
 */
export interface CriticosTierEscalation {
  tier: 1 | 2 | 3;
  destinatario: 'RT' | 'MEDICO' | 'CTO' | 'DIRETOR_MEDICO';
  destinatarioId: string;
  destinatarioNome: string;
  /** When this tier became active (sla deadline = activatedAt + slaMinutos*60s) */
  activatedAt: Timestamp;
  slaMinutos: 15 | 30 | 60;
  /** Time when contact was acknowledged at this tier (cleared on tier close) */
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
  status: 'aberto' | 'reconhecido' | 'expirado';
  attemptCanalIds: string[];
  /** Reason this tier escalated to the next (auto-expired vs. manual override) */
  motivoEscalacao?: 'sla_expirado' | 'falha_canal' | 'recusa_destinatario';
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

  /**
   * Task 05-02: 3-tier SLA escalation history.
   * Optional for backward compatibility with single-tier docs created
   * before Task 05-02. Always populated for new escalations.
   */
  tiers?: CriticosTierEscalation[];
  /** Currently active tier (1, 2, 3) — null when resolved or all expired. */
  tierAtivo?: 1 | 2 | 3 | null;
  /** Total elapsed since detection until first acknowledgment (any tier). */
  tempoPrimeiroAckMs?: number;
  /** Final resolution outcome — for compliance reporting. */
  outcome?:
    | 'reconhecido_tier1'
    | 'reconhecido_tier2'
    | 'reconhecido_tier3'
    | 'todos_tiers_expirados'
    | 'cancelado';
  /** Clinical action recorded by RT on resolve. */
  acaoClinica?: string;

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
    | 'escalacao_cancelada'
    | 'push_enviado'
    | 'push_falha'
    | 'tier_ativado'
    | 'tier_expirado'
    | 'tier_reconhecido'
    | 'acao_clinica_registrada';

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

/** NOTIVISA draft for reportable conditions */
export interface NOTIVISADraft {
  id: string;
  escalacaoId: string;
  laudoId: string;

  status: 'rascunho' | 'sob_revisao_rt' | 'enviado_notivisa' | 'cancelado';
  tipo: string;
  descricao: string;
  criteriosDeRisco: string[];
  formFields: Record<string, any>;

  criadoEm: Timestamp;
  revisadoPor?: string;
  revisadoEm?: Timestamp;
  deletadoEm: Timestamp | null;
}

/** Lab settings extension: critical values config */
export interface CriticosConfig {
  ativo: boolean;
  canaisPrefixo: 'SMS' | 'EMAIL' | 'SMS_THEN_EMAIL';
  slaMinutosTarget: number;
  slaAlertas: {
    minutos50Pct: number;
    minutos100Pct: number;
  };

  condicoesNotivisaveis: Array<{
    analitoId: string;
    condicao: string;
  }>;

  twilioNumberRegional: string;
  emailTemplateId?: string;
  auditLevel: 'basico' | 'completo';
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

/**
 * Resolve (acknowledge + clinical action) request — Task 05-02
 * RT calls this from CriticosDashboard ResolveModal to close the escalation
 * with a clinical action recorded for audit.
 */
export interface ResolveCriticoRequest {
  labId: string;
  escalacaoId: string;
  acaoClinica: string;
  tier: 1 | 2 | 3;
  notas?: string;
}

export interface ResolveCriticoResponse {
  success: boolean;
  escalacaoId: string;
  tempoSlaMs: number;
  slaStatus: 'em_prazo' | 'vencido';
  outcome:
    | 'reconhecido_tier1'
    | 'reconhecido_tier2'
    | 'reconhecido_tier3';
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
