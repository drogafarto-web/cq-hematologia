/**
 * turnosCallables.ts
 *
 * Cloud Function callable wrappers para operações de escrita no módulo Turnos.
 * DL-1 — LOCKED DECISION: todas as escritas são callables do server.
 *
 * Cada wrapper:
 * 1. Lazy-loads via httpsCallable (não carrega no import)
 * 2. Injeta labId do contexto do caller (via hook)
 * 3. Traduz erros Firebase → Error legível em PT-BR
 */

import { functions, httpsCallable, type HttpsCallable } from '../../../shared/services/firebase';
import type { LabId } from '../types/shared_refs';

// ─── Result types ──────────────────────────────────────────────────────────

export interface CallCreateTurnoResult {
  ok: true;
  turnoId: string;
}

export interface CallUpdateTurnoResult {
  ok: true;
}

export interface CallSoftDeleteTurnoResult {
  ok: true;
}

export interface CallBackfill90DaysResult {
  ok: true;
  created: number;
  skipped: number;
  dryRun: boolean;
}

export interface CallSupervisorCheckinResult {
  ok: true;
  presencaStatus: 'active';
  isSubstitute: boolean;
}

export interface CallSupervisorCheckoutResult {
  ok: true;
  presencaStatus: 'closed';
}

// ─── Payload types ──────────────────────────────────────────────────────────

export interface CreateTurnoPayload {
  labId: LabId;
  data: string; // ISO YYYY-MM-DD
  periodo: 'manha' | 'tarde' | 'noite' | 'plantao';
  supervisorId: string;
  observacoes?: string | null;
}

export interface UpdateTurnoPayload {
  labId: LabId;
  turnoId: string;
  observacoes?: string | null;
  supervisorName?: string; // post-backfill correction only
}

export interface SoftDeleteTurnoPayload {
  labId: LabId;
  turnoId: string;
}

export interface Backfill90DaysPayload {
  labId: LabId;
  dryRun?: boolean;
}

export interface SupervisorCheckinPayload {
  labId: LabId;
  turnoId: string;
  supervisorUid: string;
  pin?: string | null;
}

export interface SupervisorCheckoutPayload {
  labId: LabId;
  turnoId: string;
  observacoes?: string | null;
}

// ─── Lazy-loaded callables ──────────────────────────────────────────────────

let _callCreateTurno: HttpsCallable<CreateTurnoPayload, CallCreateTurnoResult> | null =
  null;
let _callUpdateTurno: HttpsCallable<UpdateTurnoPayload, CallUpdateTurnoResult> | null =
  null;
let _callSoftDeleteTurno: HttpsCallable<
  SoftDeleteTurnoPayload,
  CallSoftDeleteTurnoResult
> | null = null;
let _callBackfill90Days: HttpsCallable<
  Backfill90DaysPayload,
  CallBackfill90DaysResult
> | null = null;
let _callSupervisorCheckin: HttpsCallable<
  SupervisorCheckinPayload,
  CallSupervisorCheckinResult
> | null = null;
let _callSupervisorCheckout: HttpsCallable<
  SupervisorCheckoutPayload,
  CallSupervisorCheckoutResult
> | null = null;

function getCallCreateTurno(): HttpsCallable<CreateTurnoPayload, CallCreateTurnoResult> {
  if (!_callCreateTurno) {
    _callCreateTurno = httpsCallable(functions, 'turnos_createTurno');
  }
  return _callCreateTurno;
}

function getCallUpdateTurno(): HttpsCallable<UpdateTurnoPayload, CallUpdateTurnoResult> {
  if (!_callUpdateTurno) {
    _callUpdateTurno = httpsCallable(functions, 'turnos_updateTurno');
  }
  return _callUpdateTurno;
}

function getCallSoftDeleteTurno(): HttpsCallable<
  SoftDeleteTurnoPayload,
  CallSoftDeleteTurnoResult
> {
  if (!_callSoftDeleteTurno) {
    _callSoftDeleteTurno = httpsCallable(functions, 'turnos_softDeleteTurno');
  }
  return _callSoftDeleteTurno;
}

function getCallBackfill90Days(): HttpsCallable<
  Backfill90DaysPayload,
  CallBackfill90DaysResult
> {
  if (!_callBackfill90Days) {
    _callBackfill90Days = httpsCallable(functions, 'turnos_backfill90Days');
  }
  return _callBackfill90Days;
}

function getCallSupervisorCheckin(): HttpsCallable<
  SupervisorCheckinPayload,
  CallSupervisorCheckinResult
> {
  if (!_callSupervisorCheckin) {
    _callSupervisorCheckin = httpsCallable(functions, 'turnos_supervisorCheckin');
  }
  return _callSupervisorCheckin;
}

function getCallSupervisorCheckout(): HttpsCallable<
  SupervisorCheckoutPayload,
  CallSupervisorCheckoutResult
> {
  if (!_callSupervisorCheckout) {
    _callSupervisorCheckout = httpsCallable(functions, 'turnos_supervisorCheckout');
  }
  return _callSupervisorCheckout;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new turno via Cloud Function.
 * Throws Error if validation fails or labId is not active.
 */
export async function callCreateTurno(
  payload: CreateTurnoPayload,
): Promise<CallCreateTurnoResult> {
  try {
    const result = await getCallCreateTurno()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Update an existing turno via Cloud Function.
 * Only observacoes and supervisorName (post-backfill) are editable.
 */
export async function callUpdateTurno(
  payload: UpdateTurnoPayload,
): Promise<CallUpdateTurnoResult> {
  try {
    const result = await getCallUpdateTurno()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Soft-delete a turno via Cloud Function.
 */
export async function callSoftDeleteTurno(
  payload: SoftDeleteTurnoPayload,
): Promise<CallSoftDeleteTurnoResult> {
  try {
    const result = await getCallSoftDeleteTurno()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Backfill turnos for last 90 days.
 * Admin-only. Idempotent.
 */
export async function callBackfill90Days(
  payload: Backfill90DaysPayload,
): Promise<CallBackfill90DaysResult> {
  try {
    const result = await getCallBackfill90Days()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Supervisor presencial check-in.
 * RDC 978/2025 Art. 122 — supervisor confirms physical presence at start of shift.
 * Server validates: window (≤30min early, before fim), member of designated supervisor
 * or pre-designated substitute, optional PIN.
 */
export async function callSupervisorCheckin(
  payload: SupervisorCheckinPayload,
): Promise<CallSupervisorCheckinResult> {
  try {
    const result = await getCallSupervisorCheckin()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

/**
 * Supervisor presencial check-out.
 * RDC 978/2025 Art. 122 — supervisor confirms shift closure.
 * Server validates: only the supervisor who checked in may close (caller uid match).
 */
export async function callSupervisorCheckout(
  payload: SupervisorCheckoutPayload,
): Promise<CallSupervisorCheckoutResult> {
  try {
    const result = await getCallSupervisorCheckout()(payload);
    return result.data;
  } catch (error) {
    throw translateError(error);
  }
}

// ─── Error translation ──────────────────────────────────────────────────────

function translateError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message;

    // Firebase Cloud Function errors
    if (message.includes('UNAUTHENTICATED')) {
      return new Error('Autenticação necessária.');
    }
    if (message.includes('PERMISSION_DENIED')) {
      return new Error('Sem permissão para este módulo — contate o administrador.');
    }
    if (message.includes('NOT_FOUND')) {
      return new Error('Recurso não encontrado.');
    }
    if (message.includes('INVALID_ARGUMENT')) {
      // Extract details if available
      const match = message.match(/Dados inválidos: (.+)/);
      return new Error(match ? match[1] : 'Dados inválidos.');
    }
    if (message.includes('FAILED_PRECONDITION')) {
      const match = message.match(/FAILED_PRECONDITION: (.+)/);
      return new Error(match ? match[1] : 'Operação não permitida no estado atual.');
    }
    if (message.includes('INTERNAL')) {
      return new Error('Erro ao processar solicitação (cloud function).');
    }

    return new Error(message);
  }

  return new Error('Erro desconhecido ao chamar função.');
}
