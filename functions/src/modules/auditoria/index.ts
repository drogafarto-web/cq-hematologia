/**
 * Auditoria Interna Module — Cloud Function Callables
 *
 * Exports all auditoria-related Cloud Functions for registration in functions/src/index.ts
 */

export { createAuditoria } from './auditoria';
export { registerAchado } from './auditoria';
export { createPlanoAcao } from './auditoria';
export { closeAuditoria } from './auditoria';
export { registerPresenca } from './auditoria';
export { installChecklistTemplate } from './auditoria';
export { updateChecklistResponses } from './auditoria';
export { generateAuditReportPDF } from './generatePDF';
