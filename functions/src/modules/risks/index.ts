/**
 * index.ts (server — risks module barrel)
 *
 * Re-exports all callables, validators, and helpers from the risks module.
 * Loaded by ../index.ts.
 */

export * from './validators';
export * from './signatureCanonical';
export { risks_createRisk } from './createRisk';
export { risks_updateRisk } from './updateRisk';
export { risks_softDeleteRisk } from './softDeleteRisk';
export { risks_registrarRevisao } from './registrarRevisao';
export { onRiskEventCreated } from './onRiskEventCreated';

// Later tasks will add:
//   - risks_seedFromCsv (stretch, T5 optional)
//   - scheduledReview (cron, T6)
