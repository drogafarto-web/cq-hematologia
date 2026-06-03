/**
 * Barrel re-exports for turnos module.
 * Callables + trigger are wired in functions/src/index.ts.
 */

// Validators + helpers
export {
  assertTurnosAccess,
  turnosCollection,
  escalasCollection,
  escalaPadraoDoc,
  ensureTurnosLabRoot,
} from './validators';
export type {
  CreateTurnoInput,
  UpdateTurnoInput,
  SoftDeleteTurnoInput,
  Backfill90DaysInput,
  CreateEscalaInput,
  UpdateEscalaInput,
  SoftDeleteEscalaInput,
  SaveEscalaPadraoInput,
  ApplyEscalaPadraoInput,
} from './validators';

// Signature
export { generateTurnosSignatureServer, sha256Hex, sortedStringify } from './signatureCanonical';
export type { LogicalSignature, TurnoPayload } from './signatureCanonical';

// Callables + trigger (turnos efetivos)
export { turnos_createTurno } from './createTurno';
export { turnos_updateTurno } from './updateTurno';
export { turnos_softDeleteTurno } from './softDeleteTurno';
export { turnos_backfill90Days } from './backfill90Days';
export { turnos_supervisorCheckin } from './supervisorCheckin';
export { turnos_supervisorCheckout } from './supervisorCheckout';
export { onTurnoEventCreated } from './onTurnoEventCreated';

// Callables (escala)
export { turnos_createEscala } from './createEscala';
export { turnos_updateEscala } from './updateEscala';
export { turnos_softDeleteEscala } from './softDeleteEscala';
export { turnos_saveEscalaPadrao } from './saveEscalaPadrao';
export { turnos_applyEscalaPadrao } from './applyEscalaPadrao';
