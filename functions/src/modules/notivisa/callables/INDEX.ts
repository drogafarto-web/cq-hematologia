/**
 * NOTIVISA Callables — Index & Exports
 * Phase 4 — All Cloud Function callables for government integration
 *
 * Export pattern: Each callable is a default export from its own file.
 * This index re-exports them for convenience and provides type definitions.
 *
 * Usage in functions/src/index.ts:
 * import { authenticatePortal, getPatientData, submitRequisition, trackSampleStatus } from './modules/notivisa/callables';
 */

// Import and re-export callables
export { authenticatePortal } from './authenticatePortal';
export { getPatientData } from './getPatientData';
export { submitRequisition } from './submitRequisition';
export { trackSampleStatus } from './trackSampleStatus';

// Phase 4 — Callables 5-8 (Result Management & Audit Trail)
export { updateResultStatus } from './updateResultStatus';
export { fetchTestResults } from './fetchTestResults';
export { validateAuthorization } from './validateAuthorization';
export { logAuditTrail } from './logAuditTrail';

// Type definitions for callable inputs/outputs
export type {} from // authenticatePortal types
// (defined inline in callable, exported here for reference)
'./authenticatePortal';

export type {} from // getPatientData types
// (defined inline in callable, exported here for reference)
'./getPatientData';

export type {} from // submitRequisition types
// (defined inline in callable, exported here for reference)
'./submitRequisition';

export type {} from // trackSampleStatus types
// (defined inline in callable, exported here for reference)
'./trackSampleStatus';

/**
 * Callable registration helper
 * Use in functions/src/index.ts to register all NOTIVISA callables at once
 *
 * Example:
 * const { authenticatePortal, getPatientData, submitRequisition, trackSampleStatus } = require('./modules/notivisa/callables');
 *
 * exports.authenticatePortal = authenticatePortal;
 * exports.getPatientData = getPatientData;
 * exports.submitRequisition = submitRequisition;
 * exports.trackSampleStatus = trackSampleStatus;
 */
