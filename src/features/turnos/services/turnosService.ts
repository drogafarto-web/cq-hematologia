/**
 * turnosService.ts
 *
 * Camada de persistência multi-tenant do módulo Turnos.
 * Toda operação recebe `labId` explicitamente — não há caminho que permita
 * escrita sem tenant. Documentos também carregam `labId` redundante para
 * defense-in-depth nas security rules.
 *
 * DL-1 — LOCKED DECISION: Todas as escritas (create/update/delete) são
 * Cloud Function callables. Service client-side é read-only.
 */

import {
  Timestamp,
  collection,
  db,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import type { Turno, TurnoFilters, TurnoAuditEvent } from '../types/Turno';
import type { LabId } from '../types/shared_refs';

// ─── Raiz e caminhos ──────────────────────────────────────────────────────────

const TURNOS_ROOT = 'labs';

const turnosCol = (labId: LabId): CollectionReference =>
  collection(db, TURNOS_ROOT, labId, 'turnos');

const turnoDoc = (labId: LabId, turnoId: string): DocumentReference =>
  doc(turnosCol(labId), turnoId);

const turnoEventsCol = (labId: LabId, turnoId: string): CollectionReference =>
  collection(turnoDoc(labId, turnoId), 'events');

// ─── Mapping snapshot → entidade ──────────────────────────────────────────────

function mapTurno(snap: QueryDocumentSnapshot): Turno {
  const d = snap.data();
  return {
    id: snap.id,
    labId: d.labId as LabId,
    data: d.data as string,
    periodo: d.periodo as Turno['periodo'],
    supervisorId: d.supervisorId as string,
    supervisorName: d.supervisorName as string,
    supervisorCRBM: d.supervisorCRBM as string,
    certificatesActive: (d.certificatesActive ?? []) as Turno['certificatesActive'],
    observacoes: (d.observacoes ?? null) as string | null,
    inferred: (d.inferred ?? false) as boolean,
    logicalSignature: d.logicalSignature as Turno['logicalSignature'],
    criadoEm: d.criadoEm as Timestamp,
    deletadoEm: (d.deletadoEm ?? null) as Timestamp | null,
  };
}

function mapAuditEvent(snap: QueryDocumentSnapshot): TurnoAuditEvent {
  const d = snap.data();
  return {
    id: snap.id,
    tipo: d.tipo as TurnoAuditEvent['tipo'],
    operadorId: d.operadorId as string,
    timestamp: d.timestamp as Timestamp,
    mudancas: d.mudancas ?? undefined,
    chainHash: d.chainHash as string,
    chainHashAnterior: (d.chainHashAnterior ?? null) as string | null,
  };
}

// ─── API: Read-only (subscribe + get) ────────────────────────────────────────

export interface SubscribeTurnosOptions extends TurnoFilters {
  limit?: number;
}

/**
 * Subscribe em tempo real aos turnos do lab ativo.
 * Aplica filtros client-side para deletadoEm conforme opção.
 * Ordena por data DESC (mais recente primeiro).
 *
 * @param labId — Tenant ativo
 * @param options — Filtros e opções de subscription
 * @param callback — Chamado com a lista de turnos quando muda
 * @param onError — Callback de erro (opcional)
 * @returns Unsubscribe function
 */
export function subscribeTurnos(
  labId: LabId,
  options: SubscribeTurnosOptions = {},
  callback: (turnos: Turno[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const {
    from,
    to,
    periodo,
    supervisorId,
    includeDeleted = false,
    includeInferred = false,
    limit = 1000,
  } = options;

  const whereConstraints = [];

  // Build where constraints
  if (from || to) {
    // ISO comparison works for date strings
    if (from) whereConstraints.push(where('data', '>=', from));
    if (to) whereConstraints.push(where('data', '<=', to));
  }
  if (periodo) {
    whereConstraints.push(where('periodo', '==', periodo));
  }
  if (supervisorId) {
    whereConstraints.push(where('supervisorId', '==', supervisorId));
  }

  const q = query(turnosCol(labId), ...whereConstraints, orderBy('data', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const turnos = snapshot.docs
        .map(mapTurno)
        .filter((t) => {
          if (!includeDeleted && t.deletadoEm !== null) return false;
          if (!includeInferred && t.inferred) return false;
          return true;
        })
        .slice(0, limit);

      callback(turnos);
    },
    (error) => {
      const err = new Error(`Subscribe turnos error: ${error.message}`);
      if (onError) onError(err);
    },
  );
}

/**
 * Fetch um turno específico por ID.
 *
 * @param labId — Tenant
 * @param turnoId — ID do turno
 * @returns Turno ou null se não encontrado
 */
export async function getTurno(labId: LabId, turnoId: string): Promise<Turno | null> {
  const snap = await getDoc(turnoDoc(labId, turnoId));
  if (!snap.exists()) return null;
  return mapTurno(snap);
}

/**
 * Fetch eventos de auditoria de um turno.
 *
 * @param labId — Tenant
 * @param turnoId — ID do turno
 * @returns Array de eventos ordenados por timestamp DESC
 */
export async function getTurnoAuditTrail(
  labId: LabId,
  turnoId: string,
): Promise<TurnoAuditEvent[]> {
  const q = query(turnoEventsCol(labId, turnoId), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapAuditEvent);
}

// ─── Callable wrappers (read-only adapters) ──────────────────────────────────

/**
 * Helper para unwrap callable errors em formato legível.
 * Traduz FirebaseError → Error com mensagem em PT-BR.
 */
export function unwrapCallableError(error: unknown): Error {
  if (error instanceof Error) {
    const message = (error as any).message || error.message;
    // Try to extract Firebase error details
    if (typeof message === 'string' && message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function)');
    }
    return new Error(message);
  }
  return new Error('Erro desconhecido ao chamar função');
}

/**
 * Type-safe result wrapper para callable create.
 */
export interface CallCreateTurnoResult {
  ok: true;
  turnoId: string;
}

/**
 * Type-safe result wrapper para callable update.
 */
export interface CallUpdateTurnoResult {
  ok: true;
}

/**
 * Type-safe result wrapper para callable softDelete.
 */
export interface CallSoftDeleteTurnoResult {
  ok: true;
}

/**
 * Type-safe result wrapper para callable backfill.
 */
export interface CallBackfill90DaysResult {
  ok: true;
  created: number;
  skipped: number;
  dryRun: boolean;
}

/**
 * These are lazy-loaded via httpsCallable in hooks.
 * Exported here as type signatures only.
 */
export type CallCreateTurno = (
  payload: unknown,
) => Promise<CallCreateTurnoResult>;

export type CallUpdateTurno = (
  payload: unknown,
) => Promise<CallUpdateTurnoResult>;

export type CallSoftDeleteTurno = (
  payload: unknown,
) => Promise<CallSoftDeleteTurnoResult>;

export type CallBackfill90Days = (
  payload: unknown,
) => Promise<CallBackfill90DaysResult>;
