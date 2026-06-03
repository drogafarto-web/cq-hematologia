export type {
  Equipamento,
  EquipamentoAuditEvent,
  EquipamentoAuditEventType,
  EquipamentoDestinoFinal,
  EquipamentoFilters,
  EquipamentoSnapshot,
  EquipamentoStatus,
} from './Equipamento';
export type { ManutencaoPreventiva, ManutencaoStatus } from './ManutencaoPreventiva';
export type { EquipamentoUso } from './EquipamentoUso';
export type { EquipamentoDocumento, DocumentoTipo } from './EquipamentoDocumento';
export {
  DOCUMENTO_TIPO_LABEL,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './EquipamentoDocumento';
export type {
  Qualificacao,
  QualificacaoEtapa,
  QualificacaoInput,
  QualificacaoResultado,
} from './Qualificacao';
export {
  QUALIFICACAO_ETAPA_LABEL,
  QUALIFICACAO_ETAPA_DESC,
  QUALIFICACAO_RESULTADO_LABEL,
} from './Qualificacao';
export {
  RETENCAO_ANOS_POS_APOSENTADORIA,
  buildEquipamentoSnapshot,
  computeRetencaoAte,
  podeReceberCorrida,
  retencaoExpirada,
} from './Equipamento';
