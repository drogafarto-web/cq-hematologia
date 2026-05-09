/**
 * Auditoria Interna Module — Cloud Function Callables
 *
 * Exports all auditoria-related Cloud Functions for registration in functions/src/index.ts
 */

export { createAuditoria } from './auditoria';
export { registerAchado } from './auditoria';
export { closeAuditoria } from './auditoria';
export { installChecklistTemplate } from './auditoria';
export { updateChecklistResponses } from './auditoria';
export { generateInternalAuditReportPDF } from './generatePDF';
export { generateAuditReportPDF } from './generateReportPDF';

// Phase 11 PQ-24: Planos de Ação + Presença + Re-Auditoria (separate callables w/ CORS)
export { createPlanoAcao } from './createPlanoAcao';
export { registerPresenca } from './registerPresenca';
export { createReAuditoria } from './createReAuditoria';
