import { Timestamp } from 'firebase-admin/firestore';

/**
 * Non-Conformidade (NC) — Unified spine for compliance violations across 7 modules
 * ADR 0003: Non-Conformidade Global spine + CAPA workflow
 *
 * Integrates with:
 * - ADR 0005 (HMAC audit trail)
 * - 7 modules: Insumos, Equipamento, Qualidade, Pessoas, POPs, Evoluções, Auditoria
 */

export type NCOrigem = 'insumo' | 'equipamento' | 'controle' | 'pessoas' | 'processo' | 'outro';
export type NCSeveridade = 'leve' | 'grave' | 'critica';
export type NCStatus = 'aberta' | 'investig' | 'correcao' | 'verif_eficacia' | 'fechada' | 'cancelada';
export type CAPAStatus = 'planejada' | 'em_exec' | 'concluida';
export type EficaciaResultado = 'eficaz' | 'ineficaz' | 'nao_concluida';

/**
 * Individual status history entry (each HMAC-signed via ADR 0005)
 */
export interface StatusHistoryEntry {
  timestamp: Timestamp | { _seconds: number; _nanoseconds: number };
  novoStatus: NCStatus;
  mudadoPor: string; // uid
  motivo?: string;
  hmac: string; // ADR 0005 signature
}

/**
 * Investigação (step 1 of CAPA)
 */
export interface Investigacao {
  realizada: boolean;
  dataInicio: Timestamp | { _seconds: number; _nanoseconds: number };
  dataFim?: Timestamp | { _seconds: number; _nanoseconds: number };
  conclusao?: string; // Root cause findings
  investigadoPor?: string; // uid
}

/**
 * Ação Corretiva (step 2 of CAPA)
 */
export interface AcaoCorretiva {
  descricao: string; // Action to be taken
  dataPrevista: Timestamp | { _seconds: number; _nanoseconds: number };
  dataRealizacao?: Timestamp | { _seconds: number; _nanoseconds: number };
  responsavel: string; // uid
  status: CAPAStatus;
  resultadoObtido?: string; // What was actually done
}

/**
 * Verificação de Eficácia (step 3 of CAPA)
 */
export interface VerificacaoEficacia {
  realizada: boolean;
  resultado?: EficaciaResultado;
  dataVerificacao?: Timestamp | { _seconds: number; _nanoseconds: number };
  verificadoPor?: string; // uid
  evidencia?: string; // How efficacy was verified
  observacoes?: string; // If result was 'ineficaz', why and what's next
}

/**
 * CAPA workflow container
 */
export interface CAPA {
  investigacao?: Investigacao;
  acaoCorretiva?: AcaoCorretiva;
  verificacaoEficacia?: VerificacaoEficacia;
}

/**
 * Who opened the NC
 */
export interface NCAberta {
  timestamp: Timestamp | { _seconds: number; _nanoseconds: number };
  uid: string; // operador, supervisor
  motivo: string; // Why this NC was opened
}

/**
 * Who closed the NC (if fechada or cancelada)
 */
export interface NCFechada {
  timestamp: Timestamp | { _seconds: number; _nanoseconds: number };
  uid: string; // responsavel tecnico
  motivo: string; // Reason for closure
}

/**
 * Master Non-Conformidade document
 *
 * Collection path: /labs/{labId}/nao-conformidades/{ncId}
 */
export interface NaoConformidade {
  // Identification
  id?: string; // Firestore doc ID (auto-generated)
  labId: string; // FK to lab
  numero: string; // NC-{YYYY}-{seq} format for audit trail

  // Origin & Source
  origem: NCOrigem; // Which type of issue
  origemId?: string; // FK: insumoId, equipId, userId, popId, etc
  moduloOrigemId: string; // Which module opened: 'insumos', 'qualidade', 'equipamento', etc

  // Description
  descricao: string; // What went wrong (markdown allowed)
  severidade: NCSeveridade; // Impact level: leve|grave|critica

  // Status machine
  status: NCStatus; // Current state in workflow
  statusHistory: StatusHistoryEntry[]; // Full audit trail of all transitions

  // CAPA Workflow
  capa: CAPA; // Investigação → AçãoCorretiva → VerificaçãoEficácia

  // Timestamps
  aberta: NCAberta; // Who opened and when
  fechada?: NCFechada; // Who closed and when (if applicable)

  // Blocking gates
  bloqueiaOperacoes: boolean; // If true, module operations check & block on this NC
  operacoesTodasBloqueadas?: string[]; // Scopes: ['hematologia', 'imunologia'] if granular blocking needed

  // Audit trail (ADR 0005 integration)
  hmac: string; // HMAC-SHA256 signature of full document
  previousHash: string | null; // Chain link to previous NC in sequence
  _ncAuditTrailRef?: string; // FK to audit entry in ADR 0005 collection

  // Metadata
  createdAt?: Timestamp | { _seconds: number; _nanoseconds: number }; // denormalized
  updatedAt?: Timestamp | { _seconds: number; _nanoseconds: number }; // denormalized
  versao?: number; // Version counter for optimistic locking
}

/**
 * Request to open a new Non-Conformidade
 */
export interface OpenNaoConformidadeRequest {
  labId: string;
  origem: NCOrigem;
  origemId?: string;
  moduloOrigemId: string;
  descricao: string;
  severidade: NCSeveridade;
  uid: string; // Who is opening the NC
  motivo: string; // Why they're opening it
}

/**
 * Request to update NC status or CAPA fields
 */
export interface UpdateNaoConformidadeRequest {
  ncId: string;
  labId: string;
  uid: string; // Who is making the change

  // Optional status transition
  novoStatus?: NCStatus;
  motivoTransicao?: string;

  // Optional CAPA updates
  investigacao?: Partial<Investigacao>;
  acaoCorretiva?: Partial<AcaoCorretiva>;
  verificacaoEficacia?: Partial<VerificacaoEficacia>;
}

/**
 * Response from openNaoConformidade callable
 */
export interface OpenNaoConformidadeResponse {
  success: boolean;
  ncId: string;
  numero: string;
  hmac: string;
  message?: string;
  error?: string;
}

/**
 * Response from updateNaoConformidade callable
 */
export interface UpdateNaoConformidadeResponse {
  success: boolean;
  ncId: string;
  novoStatus: NCStatus;
  hmac: string;
  message?: string;
  error?: string;
}

/**
 * Query result for checkNCs gate (used in 7-module integration)
 */
export interface NCCheckResult {
  hasCriticalNCs: boolean; // If true, operations should be blocked
  criticalNCs: Array<{
    ncId: string;
    numero: string;
    severidade: NCSeveridade;
    descricao: string;
    bloqueiaOperacoes: boolean;
  }>;
  message?: string; // User-facing message if blocking
}

/**
 * CAPA workflow state machine transitions
 */
export type CAPATransition =
  | 'aberta_to_investig'          // NC opened → investigation started
  | 'investig_to_correcao'        // Investigation concluded → action planned
  | 'correcao_to_verif_eficacia'  // Action executed → verify efficacy
  | 'verif_eficacia_to_fechada'   // Efficacy verified → close (if eficaz)
  | 'verif_eficacia_to_investig'  // Efficacy failed → reopen investigation
  | 'cancelada'                   // Any state → cancel (supervisor only);

/**
 * Audit event for NC lifecycle (logged to ADR 0005 audit trail)
 */
export interface NCAuditEvent {
  operacao: 'nc.aberta' | 'nc.status_changed' | 'nc.investigada' | 'nc.acao_realizada' | 'nc.eficacia_verificada' | 'nc.fechada';
  ncId: string;
  numero: string;
  labId: string;
  anteriorStatus?: NCStatus;
  novoStatus?: NCStatus;
  payload: Record<string, any>;
}
