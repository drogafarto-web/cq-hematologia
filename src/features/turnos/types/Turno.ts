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
