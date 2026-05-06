export type {
  Equipamento,
  EquipamentoAuditEvent,
  EquipamentoAuditEventType,
  EquipamentoDestinoFinal,
  EquipamentoFilters,
  EquipamentoSnapshot,
  EquipamentoStatus,
} from './Equipamento';
export {
  RETENCAO_ANOS_POS_APOSENTADORIA,
  buildEquipamentoSnapshot,
  computeRetencaoAte,
  podeReceberCorrida,
  retencaoExpirada,
} from './Equipamento';
