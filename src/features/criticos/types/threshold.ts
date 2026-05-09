/**
 * criticos/types/threshold.ts
 *
 * Type definitions and Zod validators for Critical Values (Críticos) threshold system.
 * Implements RDC 978 Art. 128 (rastreabilidade de críticos) + DICQ 4.3 (auditoria).
 *
 * Covers:
 * 1. CriticosThreshold — Lab-specific alert thresholds per analyte
 * 2. CriticosEscalacao — Master escalation record with SLA tracking
 * 3. CriticosLogEvento — Immutable event audit log
 * 4. CriticosConfig — Lab-wide critical values settings
 *
 * Multi-tenant: all collections live in /{labId}/criticos/* or /labs/{labId}/criticos/*
 * Soft-delete only (RN-06). LogicalSignature on mutable records (RN-signature).
 */

import { z } from 'zod';
import type { Timestamp } from '../../../shared/services/firebase';

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Escalation channel type */
export enum CriticosCanal {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  PUSH = 'PUSH',
}

/** Escalation attempt delivery status */
export enum CriticosAttemptStatus {
  ENVIADO = 'enviado',
  ENTREGUE = 'entregue',
  FALHA = 'falha',
  DESCARTADO = 'descartado',
}

/** Master escalation record status */
export enum CriticosEscalacaoStatus {
  ENVIADO = 'enviado',
  RECONHECIDO = 'reconhecido',
  CANCELADO = 'cancelado',
}

/** SLA evaluation result */
export enum CriticosSLAStatus {
  EM_PRAZO = 'em_prazo',
  VENCIDO = 'vencido',
  NAO_APLICAVEL = 'nao_aplicavel',
}

/** Severity level of critical value */
export enum CriticosSeveridade {
  ALTA = 'alta',
  BAIXA = 'baixa',
}

/** Event log entry type */
export enum CriticosEventoTipo {
  SMS_ENVIADO = 'sms_enviado',
  SMS_ENTREGUE = 'sms_entregue',
  SMS_FALHA = 'sms_falha',
  EMAIL_ENVIADO = 'email_enviado',
  EMAIL_ENTREGUE = 'email_entregue',
  EMAIL_FALHA = 'email_falha',
  WEBHOOK_DELIVERY_CONFIRMED = 'webhook_delivery_confirmed',
  RECONHECIMENTO_MANUAL = 'reconhecimento_manual',
  SLA_VENCIDO_ALERTA = 'sla_vencido_alerta',
  ESCALACAO_CANCELADA = 'escalacao_cancelada',
  PUSH_ENVIADO = 'push_enviado',
  PUSH_FALHA = 'push_falha',
  TIER_ATIVADO = 'tier_ativado',
  TIER_EXPIRADO = 'tier_expirado',
  TIER_RECONHECIDO = 'tier_reconhecido',
  ACAO_CLINICA_REGISTRADA = 'acao_clinica_registrada',
}

/** Recipient role at escalation tier */
export enum CriticosTierDestinatario {
  RT = 'RT',
  MEDICO = 'MEDICO',
  CTO = 'CTO',
  DIRETOR_MEDICO = 'DIRETOR_MEDICO',
}

/** Tier escalation status */
export enum CriticosTierStatus {
  ABERTO = 'aberto',
  RECONHECIDO = 'reconhecido',
  EXPIRADO = 'expirado',
}

/** Tier escalation outcome reason */
export enum CriticosTierMotivo {
  SLA_EXPIRADO = 'sla_expirado',
  FALHA_CANAL = 'falha_canal',
  RECUSA_DESTINATARIO = 'recusa_destinatario',
}

/** Final resolution outcome */
export enum CriticosOutcome {
  RECONHECIDO_TIER1 = 'reconhecido_tier1',
  RECONHECIDO_TIER2 = 'reconhecido_tier2',
  RECONHECIDO_TIER3 = 'reconhecido_tier3',
  TODOS_TIERS_EXPIRADOS = 'todos_tiers_expirados',
  CANCELADO = 'cancelado',
}

/** Lab-wide critical values config channel preference */
export enum CriticosConfigCanal {
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  SMS_THEN_EMAIL = 'SMS_THEN_EMAIL',
}

/** Lab audit level for critical events */
export enum CriticosConfigAuditLevel {
  BASICO = 'basico',
  COMPLETO = 'completo',
}

// ─── LogicalSignature (RN-06) ────────────────────────────────────────────────

export interface LogicalSignature {
  /** SHA-256 hash (64 chars hex) of immutable payload */
  hash: string;
  /** Operator ID — must equal request.auth.uid at sign time */
  operatorId: string;
  /** Timestamp of signature creation */
  ts: Timestamp;
}

// ─── CriticosThreshold ───────────────────────────────────────────────────────

/**
 * Lab-specific alert threshold for a single analyte.
 * Defines min/max boundaries that trigger critical value detection.
 *
 * Multi-tenant path: /criticos-thresholds/{labId}/thresholds/{thresholdId}
 * Soft-delete only (RN-06).
 */
export interface CriticosThreshold {
  /** Unique identifier */
  readonly id: string;
  /** Tenant ID — redundant in payload */
  readonly labId: string;

  /** Reference to analyte definition */
  readonly analitoId: string;
  /** Cached analyte name for display */
  readonly analitoNome: string;
  /** Unit of measurement (e.g., "mg/dL", "U/L") */
  readonly unidade: string;

  /** Minimum critical value (null = no lower bound) */
  readonly min: number | null;
  /** Maximum critical value (null = no upper bound) */
  readonly max: number | null;

  /** Always mark as critical regardless of min/max (e.g., negative values where impossible) */
  readonly alwaysCritico?: boolean;
  /** Never mark as critical even if outside boundaries (manual override) */
  readonly neverCritico?: boolean;

  /** Criticality level: alta (immediate escalation) or baixa (documented only) */
  readonly severidade: 'alta' | 'baixa';

  /** Optional conditional rules (age, sex) — if not met, threshold does not apply */
  readonly condicional?: {
    idadeMin?: number;
    idadeMax?: number;
    sexo?: 'M' | 'F';
  };

  /** Active flag — false hides from detection without deletion */
  readonly ativo: boolean;

  // Audit fields
  readonly criadoEm: Timestamp;
  /** User who created this threshold */
  readonly criadoPor: string;
  /** Soft-delete marker (null = active) */
  readonly deletadoEm: Timestamp | null;
}

/**
 * Input DTO for CriticosThreshold creation/update.
 * Service is sole owner of id, labId, criadoEm, deletadoEm.
 * criadoPor is optional in input (service injects from auth context).
 */
export interface CriticosThresholdInput {
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
  criadoPor?: string;
}

// ─── CriticosEscalacao (Master record) ────────────────────────────────────────

/**
 * Single escalation attempt within an escalation record.
 * Immutable once created — appended to CriticosEscalacao.escalacoes array.
 */
export interface CriticosEscalacaoAttempt {
  /** Unique ID within this escalation */
  readonly canalId: string;
  /** Delivery channel */
  readonly canal: CriticosCanal;
  /** Current delivery status */
  readonly status: CriticosAttemptStatus;

  /** When this attempt was initiated */
  readonly enviado_em: Timestamp;
  /** When delivery was confirmed (null if not yet confirmed) */
  readonly entregue_em?: Timestamp;
  /** Failure reason if applicable */
  readonly motivo_falha?: string;
  /** Provider message ID (SMS SID, email ID, etc.) for correlation */
  readonly provider_messageId?: string;

  /** Which retry attempt this was (1 = first, 2 = second, ...) */
  readonly tentativa_numero: number;
  /** Manual operator override info if applicable */
  readonly operador_manual?: string;

  /** SLA tier that triggered this attempt (1, 2, or 3) */
  readonly tier?: 1 | 2 | 3;
  /** Role of recipient contacted at this tier */
  readonly destinatario?: CriticosTierDestinatario;
  /** User ID or external contact identifier */
  readonly destinatario_id?: string;
}

/**
 * Per-tier SLA escalation record (Task 05-02).
 * Tracks 3-tier escalation lifecycle independent of channel attempts.
 *
 * Tier 1: 0–15min   → contact RT (Responsável Técnico)
 * Tier 2: 15–30min  → contact attending physician
 * Tier 3: 30–60min  → escalate to CTO / Diretor Médico
 *
 * RDC 978 Art. 5.7.1: critical communication mandatory <60 min.
 */
export interface CriticosTierEscalation {
  /** Tier number (1, 2, or 3) */
  readonly tier: 1 | 2 | 3;
  /** Role of intended recipient */
  readonly destinatario: CriticosTierDestinatario;
  /** User ID of recipient */
  readonly destinatarioId: string;
  /** Cached recipient name for display */
  readonly destinatarioNome: string;

  /** When this tier became active (SLA deadline = activatedAt + slaMinutos*60s) */
  readonly activatedAt: Timestamp;
  /** SLA window duration in minutes */
  readonly slaMinutos: 15 | 30 | 60;

  /** When acknowledgment was received at this tier */
  readonly acknowledgedAt?: Timestamp;
  /** User who acknowledged (may differ from destinatarioId) */
  readonly acknowledgedBy?: string;

  /** Current tier status */
  readonly status: CriticosTierStatus;

  /** List of attempt IDs sent at this tier (references CriticosEscalacaoAttempt.canalId) */
  readonly attemptCanalIds: string[];

  /** Why this tier escalated to the next (SLA expiry, channel failure, or recipient refusal) */
  readonly motivoEscalacao?: CriticosTierMotivo;
}

/**
 * Master escalation record — tracks complete lifecycle of a critical value alert.
 *
 * Multi-tenant path: /criticos-escalacoes/{labId}/escalacoes/{escalacaoId}
 * Soft-delete only (RN-06).
 */
export interface CriticosEscalacao {
  /** Unique identifier */
  readonly id: string;
  /** Tenant ID — redundant in payload */
  readonly labId: string;

  // Reference to detected critical value
  readonly laudoId: string;
  readonly laudoVersion: number;
  readonly exameId: string;
  readonly analitoId: string;
  readonly valorObtido: number;

  // Reference to threshold that triggered detection
  readonly thresholdId: string;
  /** Severity level of this critical value */
  readonly severidade: 'alta' | 'baixa';
  /** Human-readable reason (e.g., "above max") */
  readonly motivo: string;

  // Patient info (snapshot at detection time)
  readonly pacienteId: string;
  readonly pacienteNome: string;
  readonly pacienteIdade: number;
  readonly pacienteSexo: 'M' | 'F' | 'NI';

  // Physician info (snapshot at detection time)
  readonly medicoId: string;
  readonly medicoNome: string;
  readonly medicoTelefone: string;
  readonly medicoEmail: string;

  // RT info (snapshot at detection time)
  readonly rtId: string;
  readonly rtNome: string;
  readonly rtEmail: string;

  // Escalation attempts (immutable array)
  readonly escalacoes: CriticosEscalacaoAttempt[];

  // Master status
  readonly status: CriticosEscalacaoStatus;
  /** When acknowledgment was received */
  readonly reconhecido_em?: Timestamp;
  /** User who acknowledged */
  readonly reconhecido_por?: string;

  // SLA metrics
  /** Milliseconds from detection to first escalation attempt */
  readonly tempo_deteccao_ms?: number;
  /** Milliseconds from detection to acknowledgment */
  readonly tempo_sla_ms?: number;
  /** Whether acknowledged within SLA window */
  readonly sla_status: CriticosSLAStatus;
  /** Target SLA window in minutes */
  readonly sla_minutos_target: number;

  // NOTIVISA integration
  readonly notivisaDraftId?: string;

  // Task 05-02: 3-tier SLA escalation
  /** Tier escalation history (optional for backward compatibility) */
  readonly tiers?: CriticosTierEscalation[];
  /** Currently active tier (null when resolved) */
  readonly tierAtivo?: 1 | 2 | 3 | null;
  /** Milliseconds from detection to first acknowledgment at any tier */
  readonly tempoPrimeiroAckMs?: number;
  /** Final resolution outcome */
  readonly outcome?: CriticosOutcome;
  /** Clinical action recorded by RT on resolution */
  readonly acaoClinica?: string;

  // Audit fields
  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
  readonly atualizadoEm: Timestamp;
  readonly atualizadoPor: string;
  /** Soft-delete marker */
  readonly deletadoEm: Timestamp | null;
}

/**
 * Input DTO for CriticosEscalacao.
 * Service owns id, labId, timestamps, and audit fields.
 */
export interface CriticosEscalacaoInput {
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
  status: CriticosEscalacaoStatus;
  reconhecido_em?: Timestamp;
  reconhecido_por?: string;
  tempo_deteccao_ms?: number;
  tempo_sla_ms?: number;
  sla_status: CriticosSLAStatus;
  sla_minutos_target: number;
  notivisaDraftId?: string;
  tiers?: CriticosTierEscalation[];
  tierAtivo?: 1 | 2 | 3 | null;
  tempoPrimeiroAckMs?: number;
  outcome?: CriticosOutcome;
  acaoClinica?: string;
}

// ─── CriticosLogEvento (Immutable audit log) ─────────────────────────────────

/**
 * Append-only immutable event log for critical value escalations.
 * Each escalation attempt, status change, or manual action is logged.
 *
 * Multi-tenant path: /criticos-log/{labId}/eventos/{eventoId}
 * Never update or delete (RN-06). LogicalSignature present (RN-signature).
 */
export interface CriticosLogEvento {
  /** Unique identifier */
  readonly id: string;
  /** Tenant ID — redundant in payload */
  readonly labId: string;

  /** Reference to escalation that triggered this event */
  readonly escalacaoId: string;
  /** Reference to laudo for cross-module audit */
  readonly laudoId: string;

  /** Type of event that occurred */
  readonly tipo: CriticosEventoTipo;

  /** Structured event details (flexible key-value map) */
  readonly detalhes: Record<string, string | number | boolean>;

  /** When this event occurred */
  readonly timestamp: Timestamp;
  /** User who caused or witnessed this event */
  readonly operadorId: string;

  // Logical signature for audit trail integrity (RN-06)
  readonly assinatura: LogicalSignature;

  /** Reference to previous event in chain (for audit trail reconstruction) */
  readonly eventoAnteriorId?: string;

  /** Soft-delete marker (null = active) */
  readonly deletadoEm: Timestamp | null;
}

/**
 * Input DTO for CriticosLogEvento.
 * Service owns id, labId, timestamp, deletadoEm, and assinatura.
 */
export interface CriticosLogEventoInput {
  escalacaoId: string;
  laudoId: string;
  tipo: CriticosEventoTipo;
  detalhes: Record<string, string | number | boolean>;
  operadorId: string;
  eventoAnteriorId?: string;
}

// ─── CriticosConfig (Lab-wide settings) ──────────────────────────────────────

/**
 * Lab-wide critical values configuration.
 * Single record per lab stored in /labs/{labId}/criticos-config/{document}.
 */
export interface CriticosConfig {
  /** Master enable/disable for critical value detection and escalation */
  readonly ativo: boolean;

  /** Channel preference: SMS, EMAIL, or SMS then EMAIL fallback */
  readonly canaisPrefixo: CriticosConfigCanal;

  /** Default SLA window in minutes (e.g., 60 for RDC 978 Art. 5.7.1) */
  readonly slaMinutosTarget: number;

  /** SLA alert thresholds for dashboard warning indicators */
  readonly slaAlertas: {
    /** Alert at 50% of SLA elapsed */
    minutos50Pct: number;
    /** Alert at 100% of SLA elapsed (critical/overdue) */
    minutos100Pct: number;
  };

  /** Analyzes that require NOTIVISA reporting upon critical detection */
  readonly condicoesNotivisaveis: Array<{
    analitoId: string;
    condicao: string;
  }>;

  /** Regional Twilio phone number for SMS escalations */
  readonly twilioNumberRegional: string;

  /** Optional email template ID for escalation messages */
  readonly emailTemplateId?: string;

  /** Audit logging detail level: basico (events only) or completo (all state changes) */
  readonly auditLevel: CriticosConfigAuditLevel;
}

/**
 * Input DTO for CriticosConfig.
 */
export type CriticosConfigInput = Omit<CriticosConfig, never>;

// ─── Zod Validators ──────────────────────────────────────────────────────────

/** Shared validation builders */
const timestamp = z.instanceof(Object); // Firestore Timestamp type
const uuid = z.string().uuid().or(z.string().min(1));
const email = z.string().email();
const hash = z.string().length(64); // SHA-256 hex

// Enums
export const CriticosCanalSchema = z.nativeEnum(CriticosCanal);
export const CriticosAttemptStatusSchema = z.nativeEnum(CriticosAttemptStatus);
export const CriticosEscalacaoStatusSchema = z.nativeEnum(CriticosEscalacaoStatus);
export const CriticosSLAStatusSchema = z.nativeEnum(CriticosSLAStatus);
export const CriticosSeveridadeSchema = z.nativeEnum(CriticosSeveridade);
export const CriticosEventoTipoSchema = z.nativeEnum(CriticosEventoTipo);
export const CriticosTierDestinatarioSchema = z.nativeEnum(CriticosTierDestinatario);
export const CriticosTierStatusSchema = z.nativeEnum(CriticosTierStatus);
export const CriticosTierMotivoSchema = z.nativeEnum(CriticosTierMotivo);
export const CriticosOutcomeSchema = z.nativeEnum(CriticosOutcome);
export const CriticosConfigCanalSchema = z.nativeEnum(CriticosConfigCanal);
export const CriticosConfigAuditLevelSchema = z.nativeEnum(CriticosConfigAuditLevel);

// LogicalSignature schema
export const LogicalSignatureSchema = z.object({
  hash,
  operatorId: z.string().min(1),
  ts: timestamp,
});

// CriticosThreshold schema
export const CriticosThresholdSchema = z.object({
  id: uuid,
  labId: z.string().min(1),
  analitoId: uuid,
  analitoNome: z.string().min(1),
  unidade: z.string().min(1),
  min: z.number().or(z.null()).optional(),
  max: z.number().or(z.null()).optional(),
  alwaysCritico: z.boolean().optional(),
  neverCritico: z.boolean().optional(),
  severidade: z.enum(['alta', 'baixa']),
  condicional: z
    .object({
      idadeMin: z.number().int().min(0).optional(),
      idadeMax: z.number().int().min(0).optional(),
      sexo: z.enum(['M', 'F']).optional(),
    })
    .optional(),
  ativo: z.boolean(),
  criadoEm: timestamp,
  criadoPor: z.string().min(1),
  deletadoEm: timestamp.or(z.null()),
});

export const CriticosThresholdInputSchema = z.object({
  analitoId: uuid,
  analitoNome: z.string().min(1),
  unidade: z.string().min(1),
  min: z.number().or(z.null()),
  max: z.number().or(z.null()),
  alwaysCritico: z.boolean().optional(),
  neverCritico: z.boolean().optional(),
  severidade: z.enum(['alta', 'baixa']),
  condicional: z
    .object({
      idadeMin: z.number().int().min(0).optional(),
      idadeMax: z.number().int().min(0).optional(),
      sexo: z.enum(['M', 'F']).optional(),
    })
    .optional(),
  ativo: z.boolean(),
  criadoPor: z.string().optional(),
}).refine(
  (data) => data.min !== null || data.max !== null,
  { message: 'At least min or max must be specified', path: ['min'] }
).refine(
  (data) => {
    if (data.min !== null && data.max !== null) {
      return data.min < data.max;
    }
    return true;
  },
  { message: 'min must be less than max', path: ['min'] }
);

// CriticosEscalacaoAttempt schema
export const CriticosEscalacaoAttemptSchema = z.object({
  canalId: uuid,
  canal: CriticosCanalSchema,
  status: CriticosAttemptStatusSchema,
  enviado_em: timestamp,
  entregue_em: timestamp.optional(),
  motivo_falha: z.string().optional(),
  provider_messageId: z.string().optional(),
  tentativa_numero: z.number().int().min(1),
  operador_manual: z.string().optional(),
  tier: z.literal(1).or(z.literal(2)).or(z.literal(3)).optional(),
  destinatario: CriticosTierDestinatarioSchema.optional(),
  destinatario_id: z.string().optional(),
});

// CriticosTierEscalation schema
export const CriticosTierEscalationSchema = z.object({
  tier: z.literal(1).or(z.literal(2)).or(z.literal(3)),
  destinatario: CriticosTierDestinatarioSchema,
  destinatarioId: z.string().min(1),
  destinatarioNome: z.string().min(1),
  activatedAt: timestamp,
  slaMinutos: z.literal(15).or(z.literal(30)).or(z.literal(60)),
  acknowledgedAt: timestamp.optional(),
  acknowledgedBy: z.string().optional(),
  status: CriticosTierStatusSchema,
  attemptCanalIds: z.array(uuid),
  motivoEscalacao: CriticosTierMotivoSchema.optional(),
});

// CriticosEscalacao schema
export const CriticosEscalacaoSchema = z.object({
  id: uuid,
  labId: z.string().min(1),
  laudoId: uuid,
  laudoVersion: z.number().int().min(1),
  exameId: uuid,
  analitoId: uuid,
  valorObtido: z.number(),
  thresholdId: uuid,
  severidade: z.enum(['alta', 'baixa']),
  motivo: z.string().min(1),
  pacienteId: uuid,
  pacienteNome: z.string().min(1),
  pacienteIdade: z.number().int().min(0),
  pacienteSexo: z.enum(['M', 'F', 'NI']),
  medicoId: uuid,
  medicoNome: z.string().min(1),
  medicoTelefone: z.string().min(1),
  medicoEmail: email,
  rtId: uuid,
  rtNome: z.string().min(1),
  rtEmail: email,
  escalacoes: z.array(CriticosEscalacaoAttemptSchema),
  status: CriticosEscalacaoStatusSchema,
  reconhecido_em: timestamp.optional(),
  reconhecido_por: z.string().optional(),
  tempo_deteccao_ms: z.number().int().min(0).optional(),
  tempo_sla_ms: z.number().int().min(0).optional(),
  sla_status: CriticosSLAStatusSchema,
  sla_minutos_target: z.number().int().min(1),
  notivisaDraftId: uuid.optional(),
  tiers: z.array(CriticosTierEscalationSchema).optional(),
  tierAtivo: z.literal(1).or(z.literal(2)).or(z.literal(3)).or(z.null()).optional(),
  tempoPrimeiroAckMs: z.number().int().min(0).optional(),
  outcome: CriticosOutcomeSchema.optional(),
  acaoClinica: z.string().optional(),
  criadoEm: timestamp,
  criadoPor: z.string().min(1),
  atualizadoEm: timestamp,
  atualizadoPor: z.string().min(1),
  deletadoEm: timestamp.or(z.null()),
});

export const CriticosEscalacaoInputSchema = z.object({
  laudoId: uuid,
  laudoVersion: z.number().int().min(1),
  exameId: uuid,
  analitoId: uuid,
  valorObtido: z.number(),
  thresholdId: uuid,
  severidade: z.enum(['alta', 'baixa']),
  motivo: z.string().min(1),
  pacienteId: uuid,
  pacienteNome: z.string().min(1),
  pacienteIdade: z.number().int().min(0),
  pacienteSexo: z.enum(['M', 'F', 'NI']),
  medicoId: uuid,
  medicoNome: z.string().min(1),
  medicoTelefone: z.string().min(1),
  medicoEmail: email,
  rtId: uuid,
  rtNome: z.string().min(1),
  rtEmail: email,
  escalacoes: z.array(CriticosEscalacaoAttemptSchema),
  status: CriticosEscalacaoStatusSchema,
  reconhecido_em: timestamp.optional(),
  reconhecido_por: z.string().optional(),
  tempo_deteccao_ms: z.number().int().min(0).optional(),
  tempo_sla_ms: z.number().int().min(0).optional(),
  sla_status: CriticosSLAStatusSchema,
  sla_minutos_target: z.number().int().min(1),
  notivisaDraftId: uuid.optional(),
  tiers: z.array(CriticosTierEscalationSchema).optional(),
  tierAtivo: z.literal(1).or(z.literal(2)).or(z.literal(3)).or(z.null()).optional(),
  tempoPrimeiroAckMs: z.number().int().min(0).optional(),
  outcome: CriticosOutcomeSchema.optional(),
  acaoClinica: z.string().optional(),
});

// CriticosLogEvento schema
export const CriticosLogEventoSchema = z.object({
  id: uuid,
  labId: z.string().min(1),
  escalacaoId: uuid,
  laudoId: uuid,
  tipo: CriticosEventoTipoSchema,
  detalhes: z.record(z.union([z.string(), z.number(), z.boolean()])),
  timestamp,
  operadorId: z.string().min(1),
  assinatura: LogicalSignatureSchema,
  eventoAnteriorId: uuid.optional(),
  deletadoEm: timestamp.or(z.null()),
});

export const CriticosLogEventoInputSchema = z.object({
  escalacaoId: uuid,
  laudoId: uuid,
  tipo: CriticosEventoTipoSchema,
  detalhes: z.record(z.union([z.string(), z.number(), z.boolean()])),
  operadorId: z.string().min(1),
  eventoAnteriorId: uuid.optional(),
});

// CriticosConfig schema
export const CriticosConfigSchema = z.object({
  ativo: z.boolean(),
  canaisPrefixo: CriticosConfigCanalSchema,
  slaMinutosTarget: z.number().int().min(1),
  slaAlertas: z.object({
    minutos50Pct: z.number().int().min(1),
    minutos100Pct: z.number().int().min(1),
  }),
  condicoesNotivisaveis: z.array(
    z.object({
      analitoId: uuid,
      condicao: z.string().min(1),
    })
  ),
  twilioNumberRegional: z.string().min(1),
  emailTemplateId: uuid.optional(),
  auditLevel: CriticosConfigAuditLevelSchema,
});

export const CriticosConfigInputSchema = CriticosConfigSchema;

// ─── Backward compatibility aliases (legacy naming convention) ─────────────────

/** @deprecated Use CriticosThreshold instead */
export type CriticoThreshold = CriticosThreshold;

/** @deprecated Use CriticosThresholdInput instead */
export type CriticoThresholdInput = CriticosThresholdInput;

/** @deprecated Use CriticosThresholdInputSchema instead */
export const CriticoThresholdInputSchema = CriticosThresholdInputSchema;

/**
 * RoutingRule — Escalation routing configuration (legacy support).
 * Determines who receives notifications for critical values.
 *
 * @deprecated Phase 5: Integrated into CriticosEscalacao tier escalation.
 */
export interface RoutingRule {
  id: string;
  labId: string;
  criterioBloco: 'all' | 'byAnalyte' | 'bySeverity' | 'byAnalyteAndSeverity';
  analitoIds?: string[];
  severidades?: ('alta' | 'baixa')[];
  recipients: {
    operadorIds: string[];
    telefones: string[];
    emails: string[];
  };
  slaMinutos: number;
  ativo: boolean;
  criadoEm: Timestamp;
  deletadoEm?: Timestamp | null;
}

/** @deprecated Phase 5: Integrated into CriticosEscalacao. */
export type RoutingRuleInput = Omit<RoutingRule, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;

/**
 * AnalyteRegistry — Analyte entry (legacy support).
 * Used for dropdown in UI — now part of bioquimica module.
 *
 * @deprecated Use bioquimica/types/analito.ts instead.
 */
export interface AnalyteRegistry {
  id: string;
  nome: string;
  unidadePadrao: string;
  categoria: string;
  ativo: boolean;
}

/**
 * EscalationRecipients — Recipient resolution result (legacy support).
 * Used by detection engine — now part of CriticosEscalacao tier routing.
 *
 * @deprecated Phase 5: Integrated into CriticosTierEscalation.
 */
export interface EscalationRecipients {
  operadorIds: string[];
  telefones: string[];
  emails: string[];
  slaMinutos: number;
}

// ─── MP-3 Phase 5 Helper Functions ───────────────────────────────────────────

/**
 * MP-3 Threshold type for helper function (avoids circular import).
 * Defines the severity classification input.
 */
export interface MP3CriticoThreshold {
  faixaCritica: { min: number | null; max: number | null };
  faixaPanico: { min: number | null; max: number | null };
  severityDefault: 'low' | 'medium' | 'high' | 'panic';
}

/**
 * Classify a measured value against a threshold to determine severity.
 *
 * Rules:
 * - If valor is within faixaPanico → 'panic'
 * - Else if within faixaCritica → threshold.severityDefault (clamped to medium/high)
 * - Else → null (not critical)
 * - Open-ended bounds (null) mean "any value below/above is in range"
 *
 * @param valor Measured value
 * @param threshold Threshold configuration with faixaCritica and faixaPanico ranges
 * @returns Severity level ('low' | 'medium' | 'high' | 'panic') or null if not critical
 */
export function classifySeverity(
  valor: number,
  threshold: MP3CriticoThreshold
): 'low' | 'medium' | 'high' | 'panic' | null {
  // Check panic range first (highest priority)
  if (threshold.faixaPanico) {
    const inPanicMin =
      threshold.faixaPanico.min === null || valor >= threshold.faixaPanico.min;
    const inPanicMax =
      threshold.faixaPanico.max === null || valor <= threshold.faixaPanico.max;
    if (inPanicMin && inPanicMax) {
      return 'panic';
    }
  }

  // Check critical range
  if (threshold.faixaCritica) {
    const inCritMin =
      threshold.faixaCritica.min === null || valor >= threshold.faixaCritica.min;
    const inCritMax =
      threshold.faixaCritica.max === null || valor <= threshold.faixaCritica.max;
    if (inCritMin && inCritMax) {
      // Return default severity, ensuring it's medium or high
      const severity = threshold.severityDefault;
      if (severity === 'panic' || severity === 'low') {
        return 'medium'; // Fallback to medium for invalid defaults
      }
      return severity;
    }
  }

  return null;
}
