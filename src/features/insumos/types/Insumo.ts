/**
 * Insumo — entidade mestre de todo consumível rastreável em CIQ.
 *
 * Modelo unificado para controles, reagentes e tiras de uroanálise.
 * Discriminated union por `tipo` permite narrowing em TypeScript sem casts.
 *
 * Referência regulatória: RDC 786/2023 art. 42 (rastreabilidade de insumos),
 * RDC 302/2005 (ensaios laboratoriais), RDC 978/2025 (CIQ documental).
 *
 * Firestore path: /labs/{labId}/insumos/{insumoId}
 * Movimentações: /labs/{labId}/insumo-movimentacoes/{movId} (imutável, audit trail).
 */

import type { Timestamp } from 'firebase/firestore';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type InsumoStatus = 'ativo' | 'fechado' | 'vencido' | 'descartado';
export type InsumoTipo = 'controle' | 'reagente' | 'tira-uro';
export type InsumoModulo = 'hematologia' | 'coagulacao' | 'uroanalise' | 'imunologia';

/**
 * Nível do controle quantitativo. Alguns fabricantes usam "normal/patológico"
 * (2 níveis, comum em coagulação), outros "baixo/alto" (hematologia). O tipo
 * é frouxo de propósito — UX apresenta só o que o módulo aceita.
 */
export type InsumoNivel = 'normal' | 'patologico' | 'baixo' | 'alto';

/** Categoria de movimentação registrada no log imutável. */
export type InsumoMovimentacaoTipo = 'entrada' | 'abertura' | 'fechamento' | 'descarte';

// ─── Shared base ──────────────────────────────────────────────────────────────

/**
 * Campos comuns a todo insumo. Tipos específicos (controle/reagente/tira-uro)
 * estendem esta interface e adicionam campos por-domínio.
 */
interface InsumoBase {
  id: string;
  labId: string;
  modulo: InsumoModulo;

  /** Nome do fabricante (ex: "Bio-Rad", "Wama Diagnóstica"). */
  fabricante: string;
  /** Nome comercial do produto (ex: "Multiqual", "Uri Color"). */
  nomeComercial: string;
  /** Número do lote impresso pelo fabricante. */
  lote: string;

  /** Validade impressa pelo fabricante (fim da prateleira, ainda fechado). */
  validade: Timestamp;

  /**
   * Quando o insumo foi aberto/reconstituído. `null` = ainda fechado.
   * Marca o início da contagem de estabilidade pós-abertura.
   */
  dataAbertura: Timestamp | null;

  /**
   * Dias de estabilidade após abertura declarados pelo fabricante.
   * Zero ou negativo = mesma validade fechada (ex: reagentes secos).
   */
  diasEstabilidadeAbertura: number;

  /**
   * Validade efetiva cacheada — `min(validade, dataAbertura + diasEstabilidade)`.
   * Cloud Function scheduled atualiza status→'vencido' quando ultrapassar.
   * Sempre computar via `computeValidadeReal()` — nunca escrever direto.
   */
  validadeReal: Timestamp;

  status: InsumoStatus;

  /** Registro ANVISA (quando aplicável; exigido pela RDC 786 em inspeções). */
  registroAnvisa?: string;

  createdAt: Timestamp;
  createdBy: string;
  closedAt?: Timestamp;
  descartadoEm?: Timestamp;
  motivoDescarte?: string;
}

// ─── Variantes por tipo ──────────────────────────────────────────────────────

/**
 * Controle de qualidade — sangue/soro liofilizado ou líquido com valores-alvo.
 *
 * Quantitativo (hematologia, coagulação): usa `stats` com mean/sd por analito.
 * Qualitativo (uroanálise): usa `valoresEsperados` (string categórica OU faixa).
 * Um controle nunca é os dois — o tipo específico vem do módulo.
 */
export interface InsumoControle extends InsumoBase {
  tipo: 'controle';
  nivel: InsumoNivel;
  /**
   * Estatísticas do fabricante por analito — presente quando o módulo é
   * quantitativo (hematologia, coagulação). Chave = analyteId.
   */
  stats?: Record<string, { mean: number; sd: number }>;
  /**
   * Valores esperados categóricos ou faixa numérica — presente quando o módulo
   * é qualitativo/híbrido (uroanálise). Chave = analyteId.
   * String: valor esperado discreto (ex: "NEGATIVO", "1+").
   * { min, max }: faixa numérica aceitável (ex: pH, densidade).
   */
  valoresEsperados?: Record<string, string | { min: number; max: number }>;
}

/**
 * Reagente — consumível ativo usado durante a corrida (ex: tromboplastina,
 * hemolisante). Não é alvo de CQ, mas é rastreado para correlação em NC.
 */
export interface InsumoReagente extends InsumoBase {
  tipo: 'reagente';
  /**
   * `true` quando o reagente foi aberto e ainda não foi validado por uma
   * corrida de CQ aprovada que o declarasse em uso. `false`/ausente caso
   * contrário.
   *
   * Set automático em `openInsumo`. Clear automático no save de CQ run
   * aprovada que declarar este insumo em `reagentesInsumoIds` (analyzer/
   * hematologia) ou no campo equivalente de cada módulo (coag/uro/imuno).
   *
   * Usado para UI indicativa ("CQ pendente") e como ponto de extensão para
   * gate duro de runs de paciente quando/se o módulo existir — RDC 978/2025
   * Art.128 + CLSI EP26-A (User Evaluation of Between-Reagent Lot Variation).
   */
  qcValidationRequired?: boolean;
}

/**
 * Tira de uroanálise — dipstick multiparâmetro. Modelagem distinta de reagente
 * genérico por exigir nota fiscal + fornecedor (RDC 786 exige rastreabilidade
 * fiscal completa para insumos de diagnóstico).
 */
export interface InsumoTiraUro extends InsumoBase {
  tipo: 'tira-uro';
  modulo: 'uroanalise';
  notaFiscal?: string;
  fornecedor?: string;
  /** IDs dos analitos presentes na tira (permite filtrar tiras compatíveis). */
  analitosIncluidos: string[];
  /**
   * Mesmo semantics de `InsumoReagente.qcValidationRequired`. Tiras são
   * consumíveis ativos em runs de uroanálise — novo lote exige CQ antes
   * de entrar em rotina.
   */
  qcValidationRequired?: boolean;
}

export type Insumo = InsumoControle | InsumoReagente | InsumoTiraUro;

// ─── Movimentação (log imutável + chain hash) ────────────────────────────────

/**
 * Status da cadeia criptográfica de auditoria do evento.
 *
 * `pending` — doc recém-criado pelo cliente; `chainHash` e `sealedAt` ainda
 * nulos. A Cloud Function `onInsumoMovimentacaoCreate` processa o doc em
 * ~1-2s e transiciona para `sealed`.
 *
 * `sealed` — `chainHash` vinculado ao evento anterior do mesmo insumo.
 * Selado é final: rules + Admin SDK bloqueiam mutações subsequentes.
 */
export type InsumoMovimentacaoChainStatus = 'pending' | 'sealed';

export interface InsumoMovimentacao {
  id: string;
  insumoId: string;
  tipo: InsumoMovimentacaoTipo;
  operadorId: string;
  operadorName: string;
  /** Timestamp de servidor — ordenação canônica da cadeia. */
  timestamp: Timestamp;
  /** Timestamp ISO8601 do cliente no momento do evento — faz parte da canonical. */
  clientTimestamp: string;
  /** Motivo em descartes; opcional nos demais. */
  motivo?: string;

  /**
   * Assinatura SHA-256 do payload canônico do evento (sem dependência de
   * estado anterior) — cliente calcula e grava no create. Funciona offline.
   * 64 caracteres hex.
   */
  payloadSignature: string;

  /**
   * Chain hash = SHA-256(payloadSignature + previousChainHash). Cloud Function
   * preenche após o create. `null` enquanto `chainStatus === 'pending'`.
   * Garante tamper-evidence da cadeia de eventos do mesmo insumo.
   */
  chainHash: string | null;

  /** Estado da selagem — ver `InsumoMovimentacaoChainStatus`. */
  chainStatus: InsumoMovimentacaoChainStatus;

  /** Timestamp de servidor no momento em que a função selou o doc. */
  sealedAt?: Timestamp;
}

// ─── Filtros de consulta ──────────────────────────────────────────────────────

export interface InsumoFilters {
  tipo?: InsumoTipo;
  modulo?: InsumoModulo;
  status?: InsumoStatus;
  /** Busca parcial em lote/fabricante/nomeComercial (case-insensitive). */
  query?: string;
}

// ─── Helpers de tipo ──────────────────────────────────────────────────────────

/** Narrowing — true quando insumo é um Controle. */
export function isControle(i: Insumo): i is InsumoControle {
  return i.tipo === 'controle';
}

/** Narrowing — true quando insumo é um Reagente. */
export function isReagente(i: Insumo): i is InsumoReagente {
  return i.tipo === 'reagente';
}

/** Narrowing — true quando insumo é uma Tira de uroanálise. */
export function isTiraUro(i: Insumo): i is InsumoTiraUro {
  return i.tipo === 'tira-uro';
}

/**
 * true quando o insumo está com CQ pendente de validação — reagente/tira
 * recém-aberto ainda não cobertos por uma corrida de CQ aprovada. Controles
 * e insumos sem o flag retornam false.
 */
export function hasQCValidationPending(i: Insumo): boolean {
  if (i.tipo === 'reagente' || i.tipo === 'tira-uro') {
    return i.qcValidationRequired === true;
  }
  return false;
}
