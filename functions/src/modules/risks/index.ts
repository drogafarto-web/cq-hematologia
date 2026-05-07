/**
 * index.ts (server — risks module barrel)
 *
 * Re-exports all callables, validators, and helpers from the risks module.
 * Loaded by ../index.ts.
 */

export * from './validators';
export * from './signatureCanonical';
export { risks_createRisk } from './createRisk';
export { risks_softDeleteRisk } from './softDeleteRisk';
export { onRiskEventCreated } from './onRiskEventCreated';

// Later tasks will add:
//   - risks_updateRisk
//   - risks_registrarRevisao
//   - risks_seedFromCsv (stretch)
//   - scheduledReview (cron)
