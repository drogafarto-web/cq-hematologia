/**
 * index.ts (server — risks module barrel)
 *
 * Re-exports all callables, validators, and helpers from the risks module.
 * Loaded by ../index.ts.
 */

export * from './validators';
export * from './signatureCanonical';

// Callables are exported in ../index.ts under a // ─── risks module block
// See ../index.ts for the full list:
//   - risks_createRisk
//   - risks_updateRisk
//   - risks_softDeleteRisk
//   - risks_registrarRevisao
//   - risks_seedFromCsv (stretch)
//   - onRiskEventCreated (trigger)
//   - scheduledReview (cron)
