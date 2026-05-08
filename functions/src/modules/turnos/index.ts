/**
 * Barrel re-exports for turnos module.
 * Callables + trigger are wired in functions/src/index.ts.
 */

// Validators + helpers
export { assertTurnosAccess, turnosCollection, ensureTurnosLabRoot } from './validators';
export type {
  CreateTurnoInput,
  UpdateTurnoInput,
  SoftDeleteTurnoInput,
  Backfill90DaysInput,
} from './validators';

// Signature
export { generateTurnosSignatureServer, sha256Hex, sortedStringify } from './signatureCanonical';
export type { LogicalSignature, TurnoPayload } from './signatureCanonical';

// Callables + trigger
export { turnos_createTurno } from './createTurno';
export { turnos_updateTurno } from './updateTurno';
export { turnos_softDeleteTurno } from './softDeleteTurno';
export { turnos_backfill90Days } from './backfill90Days';
export { turnos_supervisorCheckin } from './supervisorCheckin';
export { turnos_supervisorCheckout } from './supervisorCheckout';
export { onTurnoEventCreated } from './onTurnoEventCreated';
