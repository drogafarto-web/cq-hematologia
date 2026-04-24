/**
 * Educação Continuada — barrel de callables (Fase 0b — 2026-04-24).
 *
 * Re-exportadas em `functions/src/index.ts` para descoberta pelo Firebase CLI.
 * Região herdada do `setGlobalOptions({ region: 'southamerica-east1' })`.
 */

export { ec_mintSignature } from './mintSignature';
export { ec_commitExecucaoRealizada } from './commitExecucaoRealizada';
export { ec_commitExecucaoAdiada } from './commitExecucaoAdiada';
export {
  ec_registrarAvaliacaoEficacia,
  ec_fecharAvaliacaoEficacia,
} from './registrarAvaliacaoEficacia';
export { ec_registrarAvaliacaoCompetencia } from './registrarAvaliacaoCompetencia';
// Fase 8
export { ec_criarQuestao, ec_arquivarQuestao } from './criarQuestao';
export { ec_submeterTeste } from './submeterTeste';
// Fase 9
export { ec_gerarCertificado } from './gerarCertificado';
export { validarCertificadoEc } from './validarCertificado';
export { ec_scheduledAlertasVencimento } from './scheduledAlertasVencimento';
// Fase 7 — trigger RN-08 server-side (cleanup 2026-04-24: substitui observer client)
export { ec_onColaboradorCreated } from './onColaboradorCreated';
