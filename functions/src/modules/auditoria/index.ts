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

// Checklist & Session management (separate callables)
export { installChecklistTemplate as installChecklistTemplateV2 } from './installChecklistTemplate';
export { updateChecklistResponse } from './updateChecklistResponse';
export { batchSaveResponses } from './batchSaveResponses';
export { finalizeSession } from './finalizeSession';

// Phase 11 PQ-24: Planos de Ação + Presença + Re-Auditoria (separate callables w/ CORS)
export { createPlanoAcao } from './createPlanoAcao';
export { registerPresenca } from './registerPresenca';
export { createReAuditoria } from './createReAuditoria';

// AI Suggestion Service — deterministic rule-based analysis
export { generateAISuggestion } from './generateAISuggestion';
export { detectGaps } from './detectGaps';
export { checkRecurrence } from './checkRecurrence';

// Audit Report PDF — FR-043 compliant report generation
export { generateAuditInternaPDF } from './generateAuditInternaPDF';

// NC auto-creation from critical findings
export { createNCFromAchado } from './achadoToNC';

// Email & Archive (SA-17, SA-19)
export { emailAuditReport } from './emailAuditReport';
export { archiveAuditReport, archiveAuditReportsMonthly } from './archiveAuditReport';
