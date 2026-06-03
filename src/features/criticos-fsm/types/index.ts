/**
 * Críticos FSM Type System — Phase 10 (MP-4)
 *
 * Finite-state machine for critical value lifecycle: NORMAL → CRITICO → ALERTADO → RESOLVIDO.
 * Pure types + deterministic helpers. No imports, no business logic.
 * Multi-tenant: scoped to `/labs/{labId}/criticos-fsm-cases/{caseId}`
 */

/**
 * 4-state FSM for critical value cases.
 * NORMAL: baseline state before detection
 * CRITICO: critical value detected, alert not yet escalated
 * ALERTADO: alert escalated to operators
 * RESOLVIDO: case resolved, terminal state
 */
export type CriticoFSMState = 'NORMAL' | 'CRITICO' | 'ALERTADO' | 'RESOLVIDO';

/**
 * Events that trigger state transitions.
 * Each event carries metadata for audit trail.
 */
export type CriticoTransitionEvent =
  | { type: 'detect'; detectedAt: number; valor: number; analitoId: string }
  | { type: 'alert'; alertedAt: number; channelsDelivered: string[] }
  | { type: 'acknowledge'; acknowledgedAt: number; userId: string; comment: string }
  | { type: 'resolve'; resolvedAt: number; userId: string; resolution: string };

/**
 * Immutable cryptographic signature for audit trail.
 * hash: SHA-256 of the record, size 64
 * operatorId: request.auth.uid
 * ts: timestamp (milliseconds)
 */
export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

/**
 * Individual state transition record — append-only post-CRITICO.
 * immutable: true if from or to is in {CRITICO, ALERTADO, RESOLVIDO}
 */
export interface FSMTransitionRecord {
  from: CriticoFSMState;
  to: CriticoFSMState;
  at: number; // timestamp of the transition
  event: CriticoTransitionEvent;
  operatorId: string; // who triggered the transition
  signature: LogicalSignature;
  immutable: boolean; // write-once after CRITICO
}

/**
 * Root document for a critical value case.
 * Encapsulates the full lifecycle from detection to resolution.
 */
export interface CriticoCase {
  id: string;
  labId: string;
  resultId: string;
  analitoId: string;
  currentState: CriticoFSMState;
  history: FSMTransitionRecord[]; // capped at 50; older items in /history subcollection
  detectedAt: number;
  resolvedAt: number | null;
  slaTargetMs: number; // configurable per-lab, default 5*60_000
  slaBreached: boolean; // true if alert arrived after slaTargetMs
  criadoEm: number;
  criadoPor: string;
  deletadoEm?: number; // soft-delete only
}

/**
 * Validate a state transition is allowed by the FSM rules.
 * Returns true if the transition is valid, false otherwise.
 *
 * Valid transitions:
 * - NORMAL → CRITICO
 * - CRITICO → ALERTADO
 * - ALERTADO → ALERTADO (acknowledge stays in same state)
 * - ALERTADO → RESOLVIDO (resolve moves to terminal)
 * - All others → false
 * - RESOLVIDO → * → always false (terminal)
 */
export function isValidStateTransition(from: CriticoFSMState, to: CriticoFSMState): boolean {
  if (from === 'RESOLVIDO') return false; // terminal state
  if (from === 'NORMAL' && to === 'CRITICO') return true;
  if (from === 'CRITICO' && to === 'ALERTADO') return true;
  if (from === 'ALERTADO' && to === 'ALERTADO') return true;
  if (from === 'ALERTADO' && to === 'RESOLVIDO') return true;
  return false;
}

/**
 * Deterministic state transition function.
 * Given current state and event, returns the next state or null if invalid.
 * Pure function — no side effects.
 */
export function getNextState(
  from: CriticoFSMState,
  event: CriticoTransitionEvent,
): CriticoFSMState | null {
  switch (from) {
    case 'NORMAL':
      if (event.type === 'detect') return 'CRITICO';
      return null;
    case 'CRITICO':
      if (event.type === 'alert') return 'ALERTADO';
      return null;
    case 'ALERTADO':
      if (event.type === 'acknowledge') return 'ALERTADO'; // stay in same state
      if (event.type === 'resolve') return 'RESOLVIDO';
      return null;
    case 'RESOLVIDO':
      return null; // terminal, no transitions out
    default:
      return null;
  }
}

/**
 * Check if a state is terminal (no further transitions possible).
 * Currently only RESOLVIDO is terminal.
 */
export function isTerminalState(state: CriticoFSMState): boolean {
  return state === 'RESOLVIDO';
}
