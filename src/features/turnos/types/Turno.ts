import type { LabId, LogicalSignature, Timestamp, UserId } from './shared_refs';

// ─── Enumerations ────────────────────────────────────────────────────────────

export type Periodo = 'manha' | 'tarde' | 'noite' | 'plantao';

// ─── Entidades persistidas ───────────────────────────────────────────────────

/**
 * Turno — registro de supervisor de turno.
 *
 * RN-TURNO-01: turno único por (labId, data, periodo) entre não-deletados.
 * RN-TURNO-02: supervisor ativo (ativo === true no momento da criação).
 * RN-TURNO-03: certificatesActive[] é snapshot imutável da habilitação do supervisor.
 * RN-TURNO-04: deleção lógica only (RN-06).
 * RN-TURNO-05: chainHash contínuo no audit trail (audit event subcoleção).
 */
export interface Turno {
  readonly id: string;
  readonly labId: LabId;
  /** ISO string: YYYY-MM-DD */
  data: string;
  /** Período: manha | tarde | noite | plantao */
  periodo: Periodo;
  /** Supervisor ID — FK para educacaoContinuada/{labId}/colaboradores/{id} */
  supervisorId: UserId;
  /** Nome snapshot do supervisor no momento da criação (RN-03) */
  supervisorName: string;
  /** CRBM snapshot do supervisor no momento da criação */
  supervisorCRBM: string;
  /** Array de habilitações ativas snapshot [{ id, descricao, ativo, vencimento }] */
  certificatesActive: Array<{
    id: string;
    descricao: string;
    ativo: boolean;
    vencimento: Timestamp | null;
  }>;
  /** Notas do turno (máx 500 chars) */
  observacoes: string | null;
  /** Flag: true se backfilled com supervisor inferred (RN-TURNO-03 comportamento) */
  inferred: boolean;
  /** Assinatura server-side gerada na criação */
  logicalSignature: LogicalSignature;
  readonly criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

/**
 * Input DTO para criar turno.
 * Omite campos imutáveis + snapshot fields.
 */
export type TurnoInput = {
  data: string;
  periodo: Periodo;
  supervisorId: UserId;
  observacoes?: string | null;
};

/**
 * Update DTO para editar turno.
 * Apenas observacoes e supervisorName (post-backfill correction) são editáveis.
 */
export type TurnoUpdateInput = {
  observacoes?: string | null;
  supervisorName?: string;
};

/**
 * Filtros para queries de turnos.
 */
export interface TurnoFilters {
  from?: string; // ISO YYYY-MM-DD
  to?: string; // ISO YYYY-MM-DD
  periodo?: Periodo;
  supervisorId?: string;
  includeInferred?: boolean;
  includeDeleted?: boolean;
}

/**
 * Evento de auditoria registrado em subcoleção /turnos/{turnoId}/events/.
 */
export interface TurnoAuditEvent {
  readonly id: string;
  /** Tipo: 'created' | 'updated' | 'softdeleted' | 'backfilled' */
  tipo: 'created' | 'updated' | 'softdeleted' | 'backfilled';
  /** Operador que gerou o evento */
  operadorId: string;
  /** Timestamp do evento */
  timestamp: Timestamp;
  /** Mudanças (para 'updated') */
  mudancas?: {
    campo: string;
    anterior: string | null;
    novo: string | null;
  }[];
  /** Chain hash — SHA-256 do evento anterior + canonical payload deste */
  chainHash: string;
  /** Previous chain hash para validação de continuidade */
  chainHashAnterior: string | null;
}

// ─── Tipos de cobertura (derivados) ──────────────────────────────────────────

export type TurnoCoverageStatus = 'registered' | 'inferred' | 'missing' | 'multiple';

/**
 * Coverage map: { dateISO → { periodo → status } }
 * Usado para renderizar heatmap na CoberturaReport.
 */
export type CoberturaMap = Map<string, Map<Periodo, TurnoCoverageStatus>>;

// ─── Presença do supervisor (RDC 978 Art. 122) ──────────────────────────────
// Wave 0 — Supervisor presencial enforcement. Gateia escrita de runs/laudos
// quando não há supervisor `active` no turno corrente.

/**
 * Status da presença do supervisor no turno.
 *
 * - `awaiting`: turno cadastrado, dentro da janela de checkin (até 15min antes do início)
 * - `active`: supervisor presencialmente confirmado (checkedIn) — análises liberadas
 * - `absent`: turno iniciado sem checkin no prazo — bloqueio de escrita até substituto
 * - `closed`: turno encerrado (checkout manual ou rollover automático)
 */
export type PresencaStatus = 'awaiting' | 'active' | 'absent' | 'closed';

/**
 * Snapshot do supervisor que está presencialmente ativo no turno.
 * Imutável por sessão de checkin (atualizado em novo checkin/substituição).
 */
export interface SupervisorAtivo {
  /** UID do colaborador-supervisor (FK educacaoContinuada/{labId}/colaboradores/{id}) */
  uid: UserId;
  /** Nome snapshot no momento do checkin */
  nome: string;
  /** CRBM snapshot */
  crbm: string;
  /** Timestamp do checkin presencial */
  checkedInAt: Timestamp;
  /** True se este supervisor é substituto (RDC 978 Art. 122 — substituto designado) */
  isSubstitute: boolean;
  /** UID do supervisor primário substituído (apenas quando isSubstitute=true) */
  substituteOf: UserId | null;
  /** Justificativa da substituição (≥10 chars, obrigatório quando isSubstitute=true) */
  substituteReason: string | null;
}

/**
 * Documento de presença de um turno.
 * Path: /labs/{labId}/turnos/{turnoId}/presenca/current (singleton).
 *
 * RN-PRESENCA-01: status=='active' é pré-requisito para escrita de runs/laudos
 *                 que carreguem `turnoId` de referência (rule enforcement).
 * RN-PRESENCA-02: transição awaiting → active requer presença física confirmada
 *                 (callable supervisorCheckin com biometria opcional ou PIN do RT).
 * RN-PRESENCA-03: substituto designado requer auditoria (substituteReason ≥10 chars).
 * RN-PRESENCA-04: absent → active permitido mas registra no audit trail.
 * RN-PRESENCA-05: closed é terminal — bloqueio de novo checkin no mesmo turno.
 */
export interface TurnoPresenca {
  readonly id: 'current';
  readonly turnoId: string;
  readonly labId: LabId;
  status: PresencaStatus;
  supervisorAtivo: SupervisorAtivo | null;
  /** Timestamp planejado de início (computado via periodo + data) */
  inicioPlanejado: Timestamp;
  /** Timestamp planejado de fim */
  fimPlanejado: Timestamp;
  /** Última atualização (server timestamp) */
  atualizadoEm: Timestamp;
  /** True se notificação de 15min foi enviada ao RT */
  alertaPreEnviado: boolean;
  /** True se notificação de ausência (turno iniciado sem checkin) foi enviada */
  alertaAusenciaEnviado: boolean;
}

/**
 * Cache lab-wide de qual supervisor está atualmente ativo.
 * Path: /labs/{labId}/supervisor-status/current (singleton).
 *
 * **Crítico:** rules de runs/laudos consultam este doc para liberar/bloquear escrita.
 * Atualizado atomicamente por `turnos_supervisorCheckin` / `Checkout`.
 */
export interface LabSupervisorStatus {
  readonly id: 'current';
  readonly labId: LabId;
  /** True se há supervisor com status='active' agora — single source of truth */
  hasActiveSupervisor: boolean;
  /** Turno atualmente ativo (ref) ou null */
  turnoAtivoId: string | null;
  /** UID do supervisor presencialmente confirmado */
  supervisorAtivoUid: UserId | null;
  /** Snapshot do nome para exibição rápida em badges */
  supervisorAtivoNome: string | null;
  /** True se o supervisor ativo é substituto */
  supervisorAtivoIsSubstitute: boolean;
  /** Última atualização */
  atualizadoEm: Timestamp;
}

/**
 * Input DTO para realizar checkin presencial.
 */
export interface SupervisorCheckinInput {
  turnoId: string;
  /** UID do supervisor que está fazendo checkin */
  supervisorUid: UserId;
  /** PIN de 4-6 dígitos cadastrado pelo supervisor (defense-in-depth) */
  pin?: string | null;
}

/**
 * Input DTO para designar substituto.
 */
export interface DesignateSubstituteInput {
  turnoId: string;
  /** UID do substituto (deve ser colaborador ativo com habilitação compatível) */
  substituteUid: UserId;
  /** Justificativa obrigatória (≥10 chars) — para audit trail */
  reason: string;
}

/**
 * Evento de auditoria de presença.
 * Path: /labs/{labId}/turnos/{turnoId}/presenca-events/{eventId}.
 */
export interface PresencaEvent {
  readonly id: string;
  tipo: 'checkin' | 'checkout' | 'substitute' | 'absent_marked' | 'pre_alert' | 'absence_alert';
  operadorId: string;
  supervisorUid: UserId | null;
  isSubstitute: boolean;
  reason: string | null;
  timestamp: Timestamp;
  chainHash: string;
  chainHashAnterior: string | null;
}
