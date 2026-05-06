/**
 * Bioquímica module index
 * Exports Cloud Functions for Phase 9
 */

// Phase 09-01: Foundation (bula parsing + application)
export { parseBulaBioquimica } from './parseBulaBioquimica';
export { applyBulaToLot } from './applyBulaToLot';

// Phase 09-04: Cloud Functions (recordRunBioquimica, traceability, reporting)
export { recordRunBioquimica } from './recordRunBioquimica';
export { onRunCreated } from './onRunCreated';
export { generateMonthlyReportBioquimica } from './generateMonthlyReportBioquimica';
