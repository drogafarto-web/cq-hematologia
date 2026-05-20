import type { TipoDocumento } from '../types/Documento';

/**
 * Seções obrigatórias por tipo de documento conforme PQ-014 (Elaboração de Documentos).
 * Usado como guia informativo no formulário — não bloqueia submissão.
 */
export const SECOES_POR_TIPO: Record<TipoDocumento, string[]> = {
  MQ: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrição', 'Controle de Registros', 'Anexos', 'Bibliografias'],
  CDC: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrição', 'Controle de Registros', 'Anexos'],
  DC: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrição do Cargo', 'Controle de Registros', 'Anexos'],
  PQ: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrição', 'Controle de Registros', 'Anexos', 'Bibliografias'],
  'PQ-ANA': ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrições', 'Reagentes e Insumos', 'Controle de Registros', 'Anexos'],
  'PQ-EQP': ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrições', 'Reagentes e Insumos', 'Controle de Registros', 'Anexos'],
  IT: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrições', 'Reagentes e Insumos', 'Controle de Registros', 'Anexos'],
  ITA: ['Objetivo', 'Materiais e Reagente', 'Procedimento', 'Controle de Qualidade', 'Controle de Registros', 'Anexos'],
  FR: [],
  POL: ['Objetivo', 'Definições', 'Áreas Envolvidas', 'Descrição', 'Controle de Registros'],
  LM: [],
  EXT: [],
  ATA: ['Pauta', 'Participantes', 'Deliberações', 'Encaminhamentos'],
  RAI: ['Objetivo', 'Escopo', 'Critérios', 'Constatações', 'Não Conformidades', 'Conclusão'],
};
