/**
 * Reclamacoes Module — Cloud Function Exports
 *
 * Exports all reclamacoes-related Cloud Functions for registration in functions/src/index.ts
 */

export { criarReclamacao } from './criarReclamacao';
export { classificarReclamacaoIA } from './classificarReclamacaoIA';
// DISABLED 2026-05-07 — Resend Inbound webhook deprecated as part of the
// Resend → SMTP migration. SMTP has no inbound equivalent. Source kept for
// future reactivation once a Postfix/forwarder bridge is in place. To restore,
// uncomment below and re-export from functions/src/index.ts.
// export { parseEmailReclamacao } from './parseEmailReclamacao';
export { criarNCDraft } from './criarNCDraft';
export { transitarReclamacao } from './transitarReclamacao';

// MP-6 (v1.4-final-closure) — patient-portal phase 2 intake + RCA
export {
  intakeReclamacao,
  triageReclamacao,
  startRCAFiveWhys,
  submitRCAAnswer,
  completeRCAFiveWhys,
  closeReclamacao,
} from './intakeReclamacao';
