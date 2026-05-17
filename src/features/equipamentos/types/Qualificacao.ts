/**
 * Qualificacao — registro de qualificação IQ/OQ/PQ de equipamento.
 *
 * DICQ 5.3.1.2 exige qualificação formal para equipamentos novos:
 * - IQ (Installation Qualification): instalação conforme especificações
 * - OQ (Operational Qualification): operação dentro dos parâmetros
 * - PQ (Performance Qualification): desempenho com amostras reais
 *
 * Firestore: /labs/{labId}/equipamentos/{equipamentoId}/qualificacoes/{qualId}
 * Soft-delete only.
 */

import type { Timestamp } from 'firebase/firestore';

export type QualificacaoEtapa = 'IQ' | 'OQ' | 'PQ';

export type QualificacaoResultado = 'aprovado' | 'reprovado' | 'pendente';

export const QUALIFICACAO_ETAPA_LABEL: Record<QualificacaoEtapa, string> = {
  IQ: 'Qualificação de Instalação (IQ)',
  OQ: 'Qualificação Operacional (OQ)',
  PQ: 'Qualificação de Performance (PQ)',
};

export const QUALIFICACAO_ETAPA_DESC: Record<QualificacaoEtapa, string> = {
  IQ: 'Verificação de que o equipamento foi instalado conforme especificações do fabricante.',
  OQ: 'Verificação de que o equipamento opera dentro dos parâmetros especificados.',
  PQ: 'Verificação de desempenho com amostras reais ou materiais de referência.',
};

export const QUALIFICACAO_RESULTADO_LABEL: Record<QualificacaoResultado, string> = {
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  pendente: 'Pendente',
};

export interface Qualificacao {
  id: string;
  labId: string;
  equipamentoId: string;
  etapa: QualificacaoEtapa;
  resultado: QualificacaoResultado;
  dataRealizacao: Timestamp;
  responsavelId: string;
  responsavelNome: string;
  observacoes?: string;
  /** IDs de documentos vinculados como evidência (subcoleção documentos). */
  documentoIds: string[];
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm: Timestamp | null;
}

export interface QualificacaoInput {
  etapa: QualificacaoEtapa;
  resultado: QualificacaoResultado;
  dataRealizacao: Date;
  responsavelId: string;
  responsavelNome: string;
  observacoes?: string;
  documentoIds?: string[];
}
