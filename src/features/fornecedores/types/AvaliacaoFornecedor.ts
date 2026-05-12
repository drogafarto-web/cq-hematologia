/**
 * Avaliação periódica de fornecedor (RDC 978 / apoio externo).
 *
 * Firestore: `/labs/{labId}/fornecedores/{fornecedorId}/avaliacoes-periodicas/{id}`
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from '../../educacao-continuada/types/_shared_refs';

export type ResultadoAvaliacaoFornecedor =
  | 'aprovado'
  | 'aprovado_com_ressalva'
  | 'reprovado';

export interface CriteriosAvaliadosFornecedor {
  prazoEntrega: boolean;
  qualidadeProduto: boolean;
  documentacaoCorreta: boolean;
  atendimento: boolean;
}

export interface AvaliacaoFornecedor {
  id: string;
  labId: string;
  fornecedorId: string;
  data: Timestamp;
  resultado: ResultadoAvaliacaoFornecedor;
  responsavel: string;
  responsavelNome: string;
  criteriosAvaliados: CriteriosAvaliadosFornecedor;
  observacoes?: string;
  logicalSignature: LogicalSignature;
  criadoEm: Timestamp;
}
