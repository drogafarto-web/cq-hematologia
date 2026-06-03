// Types
export type {
  Treinamento,
  TreinamentoInput,
  TreinamentoCreationRequest,
  TreinamentoFilters,
} from './types/Treinamento';
export {
  TIPO_LABEL,
  STATUS_LABEL,
  isTreinamentoPendente,
  isTreinamentoRealizado,
  diasAteVencimentoCertificado,
  calcularFrequencia,
} from './types/Treinamento';

// Service
export {
  subscribeTrainamentos,
  getTreinamento,
  getTreinamentosByPopId,
  getTreinamentosAtrasados,
  registrarPresenca,
  updateTreinamentoStatus,
  emitirCertificado,
  softDeleteTreinamento,
} from './treinamentoService';

// Hook
export { useTreinamentos } from './useTreinamentos';

// Components
export { TreinamentosList } from './components/TreinamentosList';
export { CreateTreinamentoModal } from './components/CreateTreinamentoModal';
export { RegistroPresencaUI } from './components/RegistroPresencaUI';
export { CertificadoUI } from './components/CertificadoUI';
