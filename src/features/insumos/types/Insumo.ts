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
 * Nível/polaridade do controle.
 *
 * **Quantitativo** (hematologia, coagulação, uroanálise quantitativa) — usa
 * "normal/patologico" (2 níveis, comum em coag) ou "baixo/alto" (hemato).
 *
 * **Qualitativo binário** (imunologia) — usa "positivo/negativo" indicando
 * a polaridade esperada do controle. Esse sinal alimenta a regra de veredito
 * automático do lote: positivo deve dar R, negativo deve dar NR (RDC 978/2025
 * Art.128). Não confundir com nível quantitativo — semanticamente diferente,
 * mas mesmo campo no schema pra evitar coluna nullable em todos os controles.
 *
 * UX apresenta só o subset compatível com o módulo (ver NovoLoteModal e
 * ProdutoFormModal).
 */
export type InsumoNivel =
  | 'normal'
  | 'patologico'
  | 'baixo'
  | 'alto'
  | 'positivo'
  | 'negativo';

/** Subset quantitativo de InsumoNivel — uso em hematologia/coagulação. */
export const NIVEIS_QUANTITATIVOS: ReadonlyArray<InsumoNivel> = [
  'normal',
  'patologico',
  'baixo',
  'alto',
] as const;

/** Subset qualitativo binário de InsumoNivel — uso em imunologia. */
export const NIVEIS_QUALITATIVOS: ReadonlyArray<InsumoNivel> = [
  'positivo',
  'negativo',
] as const;

/**
 * Resolve quais opções de "nível" são válidas para um módulo. Imuno é
 * estritamente qualitativo binário; demais módulos usam o vocabulário
 * quantitativo. Se um lab cadastrar um controle qualitativo em outro módulo
 * no futuro, este mapa é o ponto único de mudança.
 */
export function niveisDoModulo(modulo: InsumoModulo): ReadonlyArray<InsumoNivel> {
  return modulo === 'imunologia' ? NIVEIS_QUALITATIVOS : NIVEIS_QUANTITATIVOS;
}

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

  /**
   * Fase C (2026-04-21) — referência ao produto do catálogo. Opcional em docs
   * legados (pre-Fase C); a partir da migração, novos Insumos SEMPRE apontam
   * pro produto. UI lê dados ricos do produto (função técnica, equipamentos
   * compatíveis, etc) via `useProduto(produtoId)`.
   *
   * Quando `produtoId` é null, o doc funciona em modo legado — `fabricante`/
   * `nomeComercial` embutidos são a fonte de verdade.
   */
  produtoId?: string;

  /**
   * Fase E (2026-04-21) — referência à nota fiscal que trouxe este lote ao lab.
   * Pelo modelo: uma nota pode trazer N lotes; um lote pertence a no máximo
   * uma nota. Opcional pra backward-compat e pra lotes recebidos sem nota
   * (amostra de fabricante, doação). Quando preenchido, o fornecedor vem via
   * join `notaFiscal.fornecedorId`.
   *
   * Campos legados `notaFiscal`/`fornecedor` (strings soltas em InsumoTiraUro)
   * permanecem pra compat — UI lê via fallback quando `notaFiscalId` é null.
   */
  notaFiscalId?: string;

  /**
   * @deprecated desde 2026-04-21 — use `modulos[]`. Mantido porque (a) docs
   * antigos só populam este campo e (b) queries legadas podem depender dele.
   * Em docs novos é sempre `modulos[0]`. `getInsumoModulos()` resolve ambos
   * via backward-compat — use aquele helper em vez de ler direto.
   */
  modulo: InsumoModulo;

  /**
   * Módulos em que este insumo pode ser consumido. Source-of-truth desde
   * 2026-04-21 — um mesmo lote físico (ex: controle multianalítico Bio-Rad)
   * pode servir Hematologia + Bioquímica sem duplicação de cadastro.
   *
   * Sempre populado em docs novos. Para docs legados, o backfill idempotente
   * `backfillInsumoModulos` preenche `[modulo]`. Até o backfill rodar,
   * `getInsumoModulos()` retorna fallback `[modulo]`.
   *
   * Query: `where('modulos', 'array-contains', module)`.
   */
  modulos: InsumoModulo[];

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

  /**
   * Quantas vezes este insumo foi selecionado como ativo em um EquipmentSetup.
   * Incrementado pelo `equipmentSetupService.setActiveInsumo` quando vira
   * `toInsumoId`. Ausente em docs legados (pré-Fase A) — tratar como 0.
   *
   * Usado no banner "Setup atual" para mostrar histórico de ativações
   * ("ativado 2x — retornou ao uso após troca emergencial").
   */
  activationsCount?: number;

  /**
   * Quantas corridas usaram este insumo (soma cross-slot). Incrementado pela
   * camada de salvamento de run (Fase B, quando a conferência obrigatória for
   * implementada — até lá permanece 0/ausente).
   *
   * Exibido no banner persistente como "23 corridas" — alimenta a sensação
   * de "custo" do insumo e dispara alerta quando próximo do limite típico.
   */
  runCount?: number;

  /**
   * Timestamp da última corrida que consumiu este insumo — usado em relatórios
   * de consumo e no computed status "sem uso recente" do banner. Ausente até
   * a primeira corrida pós-Fase B. Sem uso de Firestore index — apenas leitura.
   */
  lastRunAt?: Timestamp;
}

// ─── Stats por modelo (Fase D — controles cross-equipamento) ──────────────────

/**
 * Estatísticas (mean/sd por analito) indexadas por MODELO de equipamento.
 * Bula de controle multianalítico traz faixas diferentes por modelo — o mesmo
 * lote Bio-Rad Lyphochek rodando em Yumizen H550, Micros 60 e Cell Dyn precisa
 * de 3 conjuntos de valores-alvo distintos. Gráfico de Levey-Jennings consulta
 * `statsPorModelo[equipamentoSnapshot.modelo]` em cada corrida.
 *
 * Chave externa: modelo normalizado (ex: 'YUMIZEN_H550', 'MICROS_60').
 * Chave interna: analyteId (HGB, WBC, PLT, etc).
 *
 * Para lotes de controle cadastrados antes da Fase D, o campo `stats` (sem
 * discriminação por modelo) continua sendo consultado como fallback.
 */
export type StatsPorModelo = Record<string, Record<string, { mean: number; sd: number }>>;

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
   *
   * Fase D (2026-04-21): mantido para backward-compat. Novos cadastros que
   * cobrem múltiplos equipamentos preenchem `statsPorModelo` — este campo
   * continua válido para lotes de controle usados em um único modelo.
   */
  stats?: Record<string, { mean: number; sd: number }>;
  /**
   * Fase D — stats indexadas por modelo de equipamento. Usado quando o mesmo
   * lote de controle cobre N modelos (ex: Bio-Rad Lyphochek em H550 + Micros 60).
   * Veja `StatsPorModelo` para o shape. Precedência sobre `stats` quando presente.
   */
  statsPorModelo?: StatsPorModelo;
  /**
   * Valores esperados categóricos ou faixa numérica — presente quando o módulo
   * é qualitativo/híbrido (uroanálise). Chave = analyteId.
   * String: valor esperado discreto (ex: "NEGATIVO", "1+").
   * { min, max }: faixa numérica aceitável (ex: pH, densidade).
   */
  valoresEsperados?: Record<string, string | { min: number; max: number }>;
  /**
   * Fase D (2026-04-21): IDs dos equipamentos nos quais este lote de controle
   * pode ser usado. N:1 — o mesmo sangue controle da Controllab roda em
   * Yumizen H550 e Micros 60 simultaneamente, com valores-alvo diferentes
   * (expressos em `statsPorModelo`).
   *
   * Opcional para backward-compat com docs pré-Fase D. Cadastros novos
   * preenchem obrigatoriamente via UI. Se ausente ou vazio, o controle é
   * tratado como válido em qualquer equipamento do módulo (comportamento
   * legado até o backfill).
   */
  equipamentosPermitidos?: string[];

  /**
   * Fase F (2026-04-24) — controles de kits manuais (Controle Positivo e
   * Negativo de PCR látex, VDRL em lâmina etc.) pertencem ao próprio kit e
   * são específicos de um testType. Mesma semântica de
   * `InsumoReagente.testTypesCompativeis`: ausente/vazio => genérico do
   * módulo; presente => picker prioriza. Em controles de analisador
   * quantitativo (multianalíticos Bio-Rad etc.) o campo fica vazio.
   */
  testTypesCompativeis?: string[];
}

/**
 * Reagente — consumível ativo usado durante a corrida (ex: tromboplastina,
 * hemolisante). Não é alvo de CQ, mas é rastreado para correlação em NC.
 */
export interface InsumoReagente extends InsumoBase {
  tipo: 'reagente';
  /**
   * Fase D (2026-04-21): reagentes são exclusivos de um equipamento. ABX
   * Diluent da Horiba não roda no Cell Dyn — fabricantes diferentes usam
   * químicas proprietárias. Operador escolhe o equipamento ao cadastrar o lote.
   *
   * Opcional para backward-compat com docs pré-Fase D. Cadastros novos preenchem
   * obrigatoriamente. Na corrida, runs só listam reagentes do equipamento ativo.
   */
  equipamentoId?: string;
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

  /**
   * Status de CQ por lote — semântica relevante em Imuno (CQ por lote, não
   * por corrida). Fluxo:
   *   - criação → 'pendente'
   *   - após N corridas de validação aprovadas → admin ou operador marca
   *     'aprovado' (captura em `qcApprovedAt/By`)
   *   - se reprovado → 'reprovado' + `motivoReprovacao` (opcional)
   * Bloqueia corridas de uso normal em Imuno enquanto 'pendente'/'reprovado'
   * (com override auditado disponível para qualquer operador — Fase B1).
   * Nos demais módulos (Hemato/Coag/Uro) o reagente usa `qcValidationRequired`
   * em vez deste campo — os dois podem conviver mas significam coisas distintas.
   */
  qcStatus?: 'pendente' | 'aprovado' | 'reprovado';
  qcApprovedAt?: Timestamp;
  qcApprovedBy?: string;
  /** IDs das corridas que validaram o lote (usado pra "N validações" rules). */
  qcValidationRunIds?: string[];
  motivoReprovacao?: string;

  /**
   * Fase F (2026-04-24) — testes de Imuno manuais (PCR látex, VDRL em lâmina,
   * cartela imunocromatográfica) não têm equipamento, então `equipamentoId`
   * fica vazio e a amarração é por testType. Lista dos nomes de `CIQTestType`
   * aos quais este lote se aplica.
   *
   * Ausente/vazio => lote genérico do módulo (aparece para qualquer testType
   * manual). Presente => picker filtra para o testType selecionado primeiro,
   * com fallback para os genéricos. Campo irrelevante em reagentes de
   * analisador (fluxo de setup de equipamento cobre a amarração).
   */
  testTypesCompativeis?: string[];
}

/**
 * Tira de uroanálise — dipstick multiparâmetro. Modelagem distinta de reagente
 * genérico por exigir nota fiscal + fornecedor (RDC 786 exige rastreabilidade
 * fiscal completa para insumos de diagnóstico).
 */
export interface InsumoTiraUro extends InsumoBase {
  tipo: 'tira-uro';
  modulo: 'uroanalise';
  modulos: ['uroanalise'];
  /**
   * Fase D (2026-04-21): tiras são exclusivas de um equipamento/leitor.
   * Tira Wama rodando em Uri Color Control não é a mesma da Combilyzer.
   * Opcional para backward-compat; cadastros novos preenchem.
   */
  equipamentoId?: string;
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
  /**
   * Opcional — convivem com qcValidationRequired. Se no futuro uroanálise
   * migrar pra CQ-por-lote (paralelo com Imuno), este é o ponto único.
   */
  qcStatus?: 'pendente' | 'aprovado' | 'reprovado';
  qcApprovedAt?: Timestamp;
  qcApprovedBy?: string;
  qcValidationRunIds?: string[];
  motivoReprovacao?: string;
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

/**
 * Fonte canônica da lista de módulos de um insumo — resolve o gap entre docs
 * novos (com `modulos[]`) e docs legados (só `modulo` singular). Sempre use
 * este helper em vez de ler os campos diretamente — mesmo depois do backfill,
 * porque um lab pode ter sido offline durante a migração e voltar com docs
 * pré-migração no cache.
 *
 * Garantia: retorna array não-vazio. Se o doc estiver corrompido (nenhum dos
 * dois campos populado), retorna `[]` — caller decide se loga/filtra.
 */
export function getInsumoModulos(
  i: Pick<Insumo, 'modulos' | 'modulo'>,
): InsumoModulo[] {
  if (Array.isArray(i.modulos) && i.modulos.length > 0) return i.modulos;
  if (i.modulo) return [i.modulo];
  return [];
}

/**
 * Fase D (2026-04-21): decide se um insumo pode ser usado num equipamento.
 *
 *   - Reagente/Tira: 1:1 via `equipamentoId`.
 *   - Controle: N:1 via `equipamentosPermitidos[]`.
 *
 * Backward-compat: insumos sem `equipamentoId`/`equipamentosPermitidos`
 * (legado pré-Fase D) são considerados compatíveis com qualquer equipamento
 * — permite rodar corridas antes da migração terminar. Depois que todos os
 * docs estiverem preenchidos a regra pode endurecer via rules.
 */
export function insumoCobreEquipamento(i: Insumo, equipamentoId: string): boolean {
  if (i.tipo === 'reagente' || i.tipo === 'tira-uro') {
    if (!i.equipamentoId) return true; // legado — aceita qualquer equipamento
    return i.equipamentoId === equipamentoId;
  }
  // Controle: permitidos[] (N:1). Ausente/vazio = legado, aceita qualquer.
  if (!i.equipamentosPermitidos || i.equipamentosPermitidos.length === 0) return true;
  return i.equipamentosPermitidos.includes(equipamentoId);
}

/**
 * Extrai os stats (mean/sd por analito) aplicáveis a uma corrida num modelo
 * específico de equipamento. Ordem de precedência:
 *   1. `statsPorModelo[modelo]` — quando a bula do controle traz faixas por modelo
 *   2. `stats` — fallback legado (pré-Fase D), um único conjunto para todos
 *   3. `undefined` — controle sem stats (ex: lote só com valoresEsperados qualitativos)
 */
export function resolveStatsForModelo(
  insumo: InsumoControle,
  modelo: string,
): Record<string, { mean: number; sd: number }> | undefined {
  if (insumo.statsPorModelo && insumo.statsPorModelo[modelo]) {
    return insumo.statsPorModelo[modelo];
  }
  return insumo.stats;
}
