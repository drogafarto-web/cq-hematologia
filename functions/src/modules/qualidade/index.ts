/**
 * Qualidade Module — NC (Non-Conformidade) & CAPA Workflow
 * ADR 0003: Non-Conformidade Global spine
 *
 * Exports:
 * - Cloud Callables: openNaoConformidade, updateNaoConformidade
 * - Helpers: checkNCs, CAPA workflow functions
 * - Types: NaoConformidade, related interfaces
 */

export { openNaoConformidade, updateNaoConformidade, checkNCs } from './naoConformidade';
export {
  investigarNC,
  concluirInvestigacao,
  executarAcaoCorretiva,
  registrarAcaoRealizada,
  verificarEficacia,
  reabrirInvestigacao,
  cancelarNC,
} from './capaWorkflow';
export type {
  NaoConformidade,
  NCOrigem,
  NCSeveridade,
  NCStatus,
  OpenNaoConformidadeRequest,
  OpenNaoConformidadeResponse,
  UpdateNaoConformidadeRequest,
  UpdateNaoConformidadeResponse,
  NCCheckResult,
  Investigacao,
  AcaoCorretiva,
  VerificacaoEficacia,
  CAPA,
} from './types';
