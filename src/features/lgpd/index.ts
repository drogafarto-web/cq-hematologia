export * from './types/LGPD';

// Only read/subscribe exports — create*/update*/delete* are deprecated and must not be
// re-exported from the module boundary (Phase 0b pattern: writes go through callables).
export {
  subscribeSolicitacoes,
  subscribeDPIAs,
  subscribeConsentimentos,
  subscribeLogsExclusao,
  updateSolicitacao,
} from './lgpdService';
