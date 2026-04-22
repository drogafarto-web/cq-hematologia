/**
 * NotaFiscal — doc fiscal que documenta a entrada de 1+ lotes no lab.
 *
 * Fase E (2026-04-21). Agregadora: uma nota pode trazer N produtos/lotes.
 * Cada Insumo (lote físico) passa a referenciar `notaFiscalId` — agrega
 * histórico por fornecedor, atende RDC 786 art. 42 (rastreabilidade
 * fiscal completa do insumo de diagnóstico).
 *
 * Firestore path: /labs/{labId}/notas-fiscais/{notaId}
 */

import type { Timestamp } from 'firebase/firestore';

export interface NotaFiscal {
  id: string;
  labId: string;

  /** FK obrigatório pro Fornecedor. Não é texto livre. */
  fornecedorId: string;

  /** Número da nota (pode ter letra em NFs manuais antigas). */
  numero: string;

  /** Série — default '1' mas o operador pode alterar. */
  serie?: string;

  /**
   * Chave de acesso da NFe (44 dígitos). Opcional pra compatibilizar com
   * notas manuais / cupons, mas recomendada — permite validação SEFAZ.
   */
  chaveAcesso?: string;

  /** Data de emissão pelo fornecedor. */
  dataEmissao: Timestamp;

  /** Data em que o lab recebeu fisicamente. */
  dataRecebimento: Timestamp;

  /** Valor total em R$ (centavos armazenados como number decimal). */
  valorTotal?: number;

  /** URL do PDF da DANFE no Storage (upload opcional). */
  arquivoPdfUrl?: string;

  /** Observações livres. */
  observacoes?: string;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}
