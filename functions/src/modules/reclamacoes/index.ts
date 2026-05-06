/**
 * Reclamacoes Module — Cloud Function Exports
 *
 * Exports all reclamacoes-related Cloud Functions for registration in functions/src/index.ts
 */

export { criarReclamacao } from './criarReclamacao';
export { classificarReclamacaoIA } from './classificarReclamacaoIA';
export { parseEmailReclamacao } from './parseEmailReclamacao';
export { criarNCDraft } from './criarNCDraft';
