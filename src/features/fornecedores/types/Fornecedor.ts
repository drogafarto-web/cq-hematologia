/**
 * Fornecedor — cadastro global do lab.
 *
 * Fase E (2026-04-21). Entidade estável do lab — um fornecedor é cadastrado
 * uma vez e referenciado por N notas fiscais e N lotes. Isso resolve o
 * problema anterior de "fornecedor como string livre" no InsumoTiraUro:
 *   - duplicação ("Wama" vs "Wama Diagnostica" vs "WAMA Diag.")
 *   - impossibilidade de agregar histórico por fornecedor
 *   - ausência de CNPJ → quebra RDC 786 art. 42 (rastreabilidade fiscal)
 *
 * Firestore path: /labs/{labId}/fornecedores/{fornecedorId}
 *
 * CNPJ é único por lab — o service valida via query. Validação de formato
 * (módulo 11) no cliente + rules server-side.
 */

import type { Timestamp } from 'firebase/firestore';

export interface Fornecedor {
  id: string;
  labId: string;

  /** Razão social (obrigatória) — nome formal na Receita. */
  razaoSocial: string;

  /** Nome fantasia (opcional) — exibição comercial. Cai em razaoSocial se vazio. */
  nomeFantasia?: string;

  /**
   * CNPJ normalizado (14 dígitos, sem máscara). Único por lab.
   * Formato na UI: 00.000.000/0000-00. Validação módulo 11.
   */
  cnpj: string;

  /** Inscrição estadual — exigida em NFs de saúde por SEFAZ. */
  inscricaoEstadual?: string;

  telefone?: string;
  email?: string;
  /** Endereço livre (rua, número, cidade, UF). Estruturação futura se necessário. */
  endereco?: string;

  /** Observações internas do operador (problemas recorrentes, contatos, etc). */
  observacoes?: string;

  /**
   * Soft-delete. Fornecedor inativo some dos pickers de nova nota mas o
   * histórico de lotes já comprados permanece. Hard-delete só se nunca
   * teve nota emitida.
   */
  ativo: boolean;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Normaliza CNPJ — remove tudo que não for dígito. Firestore guarda sempre
 * 14 dígitos crus; UI formata para exibição.
 */
export function normalizeCnpj(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Formata CNPJ de 14 dígitos para 00.000.000/0000-00. Retorna o input se
 * não tiver 14 dígitos (permite mostrar o que o user digitou enquanto ele
 * edita).
 */
export function formatCnpj(cnpj: string): string {
  const n = normalizeCnpj(cnpj);
  if (n.length !== 14) return cnpj;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

/**
 * Validação de CNPJ via algoritmo módulo 11 — o padrão oficial da Receita.
 * Rejeita sequências repetidas (00000000000000, 11111111111111, …) que
 * passariam no módulo 11 mas são CNPJs inválidos conhecidos.
 */
export function isValidCnpj(input: string): boolean {
  const cnpj = normalizeCnpj(input);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (slice: string, weights: number[]): number => {
    const sum = slice
      .split('')
      .reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(cnpj.slice(0, 12), w1);
  const d2 = calcDigit(cnpj.slice(0, 12) + String(d1), w2);

  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}
