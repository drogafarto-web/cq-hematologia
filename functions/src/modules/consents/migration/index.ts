/**
 * index.ts — barrel for consents/migration callables.
 *
 * Wired into the top-level functions index by the operator (see
 * .planning/proposed-changes/wave2-6-consent-backfill.md). Wave 2 Agent 6
 * intentionally does not edit functions/src/index.ts directly per task
 * constraints.
 */

export { consents_exportPatientList } from './exportPatientList';
export { consents_batchRecordConsent } from './batchRecordConsent';
