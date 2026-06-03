// Entry point for liberacao module — Phase 10-01 complete (foundation)
// Default export is placeholder; replaced in Plans 10-02+

export { default } from './LiberacaoPlaceholder';

export * from './types';
export {
  subscribeLaudos,
  getLaudo,
  getLaudoLatestVersion,
  softDeleteLaudo,
} from './services/laudoService';
export {
  subscribeVersions,
  getVersion,
  getVersionPdfUrl,
  downloadVersionPdf,
} from './services/laudoVersionService';
export {
  subscribeExameConfigs,
  getExameConfig,
  createExameConfig,
  updateExameConfig,
  softDeleteExameConfig,
} from './services/exameConfigService';
export {
  useLaudos,
  useExameConfigs,
  useExameConfigByCode,
  useLaudoVersions,
  usePDFUrl,
} from './hooks';
export {
  generateLaudoPDF as generateLaudoPDFViaCallable,
  downloadLaudoPDF,
} from './services/pdfService';
export type { GenerateLaudoPDFInput, GenerateLaudoPDFResult } from './services/pdfService';
export { validateTransition, nextStates, stateLabel, stateColor } from './utils/stateMachine';
export { classifyExame, shouldAutoRelease } from './utils/exameClassifier';
export {
  calculateChainHash,
  canonicalizePayload,
  sha256,
  isValidChainHash,
  GENESIS_CHAIN_HASH,
} from './utils/auditChain';
