/**
 * index.ts (server — consents module barrel)
 *
 * Re-exports callables, validators, and helpers for the consents module.
 * Loaded by ../../index.ts via wave2-2-consents wire-up (see proposed-changes).
 *
 * Compliance: LGPD Art. 7º + 11; DICQ 4.4 audit trail; RDC 978 Art. 128.
 */

export * from './validators';
export { recordPatientConsent } from './recordPatientConsent';
export { revokePatientConsent } from './revokePatientConsent';
