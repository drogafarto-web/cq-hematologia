import type { CQRun, WestgardViolation } from '../../../types';
import type {
  CoagNivel,
  CoagAnalyteId,
  CoagStatus,
  CoagLotStatus,
  CoagFrequencia,
  CoagEquipamento,
} from './_shared_refs';

// ─── Run (Corrida Individual) ─────────────────────────────────────────────────

/**
 * CoagulacaoRun — corrida auditável de controle de qualidade para coagulação.
 *
 * Estende CQRun omitindo campos exclusivos do fluxo de IA quantitativa do
 * analyzer/hematologia que não se aplicam ao módulo de coagulação nesta arquitetura.
 *
 * Campos omitidos:
 *  - westgardViolations  → substituído por campo homônimo tipado a CoagAnalyteId
 *  - level               → coagulação usa CoagNivel ('I' | 'II'), não 1 | 2 | 3
 *  - aiData              → mapa de analitos numéricos da IA — gerenciado separadamente
 *  - aiConfidence        → confiança por analito da IA — inaplicável neste fluxo
 *  - confirmedData       → mapa de valores confirmados — substituído por `resultados`
 *  - editedFields        → controle de edição numérica por analito — inaplicável
 *  - originalData        → snapshot de valores originais — inaplicável neste fluxo
 *
 * Firestore path: labs/{labId}/ciq-coagulacao/{lotId}/runs/{runId}
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 67/2009 + RDC 551/2021
 * Referências: CLSI H21-A5, H47-A2, H54-A · ISTH guidelines
 */
export interface CoagulacaoRun extends Omit<
  CQRun,
  | 'westgardViolations'
  | 'level'
  | 'aiData'
  | 'aiConfidence'
  | 'confirmedData'
  | 'editedFields'
  | 'originalData'
> {
  // ── Identificação ──────────────────────────────────────────────────────────

  /** Código sequencial da corrida — formato CG-YYYY-NNNN (gerado por transação Firestore). */
  runCode: string;

  /** Nível do material de controle: I = normal, II = anticoagulado/patológico (CLSI H47-A2). */
  nivel: CoagNivel;

  /** Frequência de realização do controle: diária ou vinculada à troca de lote. */
  frequencia: CoagFrequencia;

  /** Coagulômetro utilizado na corrida (literal fixo enquanto o lab opera um único equipamento). */
  equipamento: CoagEquipamento;

  // ── Controle ───────────────────────────────────────────────────────────────

  /** Número do lote do material de controle (ex: "L2024-038"). */
  loteControle: string;

  /** Fabricante do material de controle (ex: "Bio-Rad", "Helena Biosciences"). */
  fabricanteControle: string;

  /**
   * Data de abertura do frasco de controle no formato YYYY-MM-DD.
   * Atenção: estabilidade pós-abertura é de 4–8h dependendo do fabricante;
   * a validação precisa considerar hora de abertura (campo `aberturaControleHora` — v2).
   */
  aberturaControle: string;

  /** Data de validade do controle fechado (YYYY-MM-DD). */
  validadeControle: string;

  // ── Reagente (tromboplastina / ativador) ───────────────────────────────────

  /** Número do lote do reagente utilizado (tromboplastina para AP/TP, ativador para TTPA). */
  loteReagente: string;

  /** Fabricante do kit de reagente (ex: "Stago", "Instrumentation Laboratory"). */
  fabricanteReagente: string;

  /**
   * Data de abertura do kit de reagente (YYYY-MM-DD).
   * Troca de lote de reagente exige recalibração das metas (mean/SD) — CLSI EP15-A3.
   */
  aberturaReagente: string;

  /** Data de validade do reagente (YYYY-MM-DD). */
  validadeReagente: string;

  // ── Calibração INR ────────────────────────────────────────────────────────

  /**
   * International Sensitivity Index (ISI) do lote de tromboplastina em uso.
   * Fornecido pelo fabricante; obrigatório para derivação automática do RNI.
   * Fórmula: RNI = (TP_paciente / MNPT) ^ ISI — WHO Tech Report 889/1999.
   * Presente apenas quando `atividadeProtrombinica` ou `rni` está nos resultados.
   */
  isi?: number;

  /**
   * Mean Normal Prothrombin Time (MNPT) do próprio laboratório (em segundos).
   * Deve ser determinado localmente com ≥20 amostras de doadores saudáveis — ISTH guidelines.
   * Presente apenas quando `atividadeProtrombinica` ou `rni` está nos resultados.
   */
  mnpt?: number;

  // ── Ambiente ──────────────────────────────────────────────────────────────

  /** Temperatura ambiente no momento da realização, em graus Celsius (°C). */
  temperaturaAmbiente?: number;

  /** Umidade relativa do ar no momento da realização, em percentual (%). */
  umidadeAmbiente?: number;

  // ── Data ──────────────────────────────────────────────────────────────────

  /** Data de realização da corrida no formato YYYY-MM-DD. */
  dataRealizacao: string;

  // ── Resultados ────────────────────────────────────────────────────────────

  /**
   * Valores obtidos por analito.
   *
   * Unidades:
   *  - atividadeProtrombinica → % (percentual de atividade)
   *  - rni                   → adimensional (calculado; não é medido diretamente)
   *  - ttpa                  → segundos (s)
   *
   * O RNI pode ser preenchido automaticamente pelo serviço a partir de TP+ISI+MNPT.
   */
  resultados: Record<CoagAnalyteId, number>;

  // ── Conformidade ──────────────────────────────────────────────────────────

  /**
   * Decisão de conformidade da corrida derivada das regras de Westgard.
   *
   *  A = Aceitável — nenhuma regra de rejeição violada.
   *  R = Rejeitado — pelo menos uma regra de rejeição violada (requer ação corretiva).
   */
  conformidade: 'A' | 'R';

  /**
   * Analitos que violaram pelo menos uma regra de Westgard nesta corrida.
   * Array vazio quando `conformidade === 'A'`.
   */
  analitosComViolacao: CoagAnalyteId[];

  /**
   * Violações de Westgard agrupadas por corrida — reutiliza `westgardRules.ts` do analyzer.
   * Calculadas no momento do save pelo hook de Westgard do módulo.
   * Presentes quando `analitosComViolacao` é não-vazio.
   */
  westgardViolations?: WestgardViolation[];

  /**
   * Descrição da ação corretiva tomada pelo operador ou RT.
   * Obrigatória quando `conformidade === 'R'` — RDC 978/2025 Art. 128.
   * Deve descrever a causa raiz e a medida tomada para correção.
   */
  acaoCorretiva?: string;

  // ── Notificação Sanitária (RDC 67/2009 + RDC 551/2021 — Tecnovigilância) ──

  /**
   * Tipo de ocorrência de tecnovigilância a ser notificada ao NOTIVISA 2.0.
   * Aplicável apenas quando `conformidade === 'R'` e a causa é produto (não operacional).
   *
   *  queixa_tecnica — Desvio de qualidade do produto (controle ou reagente) sem dano.
   *                   Ex: controle fora da validade, reagente com reatividade inesperada.
   *  evento_adverso — Resultado de CIQ comprometido que afetou conduta clínica ou causou dano.
   *
   * RDC 67/2009 define obrigatoriedade de notificação; RDC 551/2021 atualiza o sistema.
   */
  notivisaTipo?: 'queixa_tecnica' | 'evento_adverso';

  /**
   * Status formal da notificação ao NOTIVISA 2.0.
   *
   *  pendente   — Não conformidade aberta; aguardando decisão do RT.
   *  notificado — Protocolo obtido após submissão ao NOTIVISA; campo `notivisaProtocolo` preenchido.
   *  dispensado — Causa raiz operacional (não defeito de produto); exige `notivisaJustificativa`.
   *
   * Referência: RDC 67/2009 Art. 4º e RDC 551/2021.
   */
  notivisaStatus?: 'pendente' | 'notificado' | 'dispensado';

  /** Número de protocolo retornado pelo NOTIVISA 2.0 após submissão bem-sucedida. */
  notivisaProtocolo?: string;

  /**
   * Data de envio da notificação ao NOTIVISA (YYYY-MM-DD).
   * Prazo máximo: 72h para eventos adversos, 30 dias para queixas técnicas — RDC 67/2009.
   */
  notivisaDataEnvio?: string;

  /**
   * Justificativa obrigatória quando `notivisaStatus === 'dispensado'`.
   * Deve explicar por que a causa raiz é operacional e não constitui defeito de produto.
   * Fica arquivada como evidência regulatória para eventual VISA — RDC 551/2021.
   */
  notivisaJustificativa?: string;

  // ── Operador ──────────────────────────────────────────────────────────────

  /**
   * Nome de exibição do operador responsável pela corrida.
   * Redundante com `operatorName` herdado de CQRun, mas explicitado aqui para
   * facilitar queries Firestore sem join e para o relatório impresso.
   */
  responsavel?: string;

  // ── Rastreabilidade de insumos (Fase B1 — 2026-04-21) ─────────────────────

  /**
   * Snapshot imutável dos insumos ativos no momento da corrida. Populado pelo
   * save a partir do `EquipmentSetup` do módulo. Sobrevive a edição/descarte
   * do doc mestre — exigência RDC 786/2023 art. 42.
   *
   * Coagulação exige reagente + controle. Slots presentes aqui espelham os
   * slots do setup no instante do save.
   */
  insumosSnapshot?: {
    reagente?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
    controle?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
  };

  /**
   * Flags de override — aparecem destacados em relatórios (PDF backup Fase B2).
   * `overrideMotivo` carrega a justificativa textual do operador.
   */
  insumoVencidoOverride?: boolean;
  qcNaoValidado?: boolean;
  overrideMotivo?: string;

  // ── Rastreabilidade de equipamento (Fase D — 2026-04-21) ──────────────────

  /**
   * ID do equipamento em que a corrida foi realizada. Cross-reference com
   * /labs/{labId}/equipamentos/{equipamentoId}. Nulo em runs pré-Fase D
   * (backward-compat).
   */
  equipamentoId?: string;
  /**
   * Snapshot congelado do equipamento no momento da corrida. Sobrevive à
   * aposentadoria (soft-delete, retenção 5a) e ao eventual cleanup pós-retenção.
   */
  equipamentoSnapshot?: import('../../equipamentos/types/Equipamento').EquipamentoSnapshot;
}

// ─── Lote ─────────────────────────────────────────────────────────────────────

/**
 * CoagulacaoLot — lote de controle para o módulo de coagulação.
 *
 * Documento raiz em labs/{labId}/ciq-coagulacao/{lotId}.
 * Cada combinação (loteControle × nivel) é um documento de lote independente,
 * pois mean/SD do fabricante diferem por nível.
 * As corridas ficam na subcoleção /runs — nunca embutidas no documento.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 36/2015 (rastreabilidade de insumos).
 */
export interface CoagulacaoLot {
  /** UID do documento Firestore (gerado automaticamente). */
  id: string;

  /** UID do laboratório — chave de multi-tenancy. */
  labId: string;

  // ── Identificação ──────────────────────────────────────────────────────────

  /** Nível do controle: I = normal, II = anticoagulado/patológico. */
  nivel: CoagNivel;

  /** Número do lote do material de controle — chave de identificação do lote. */
  loteControle: string;

  /** Fabricante do material de controle. */
  fabricanteControle: string;

  /** Data de abertura do lote de controle (YYYY-MM-DD). */
  aberturaControle: string;

  /** Data de validade do lote de controle (YYYY-MM-DD). */
  validadeControle: string;

  // ── Alvos do Fabricante ────────────────────────────────────────────────────

  /**
   * Média alvo por analito, conforme bula do material de controle.
   * Usada como centro da carta de Levey-Jennings.
   * Unidades: AP em %, RNI adimensional, TTPA em segundos.
   */
  mean?: Record<CoagAnalyteId, number>;

  /**
   * Desvio-padrão alvo por analito, conforme bula do material de controle.
   * Limites ±2SD = aviso; ±3SD = rejeição (regras Westgard clássicas).
   */
  sd?: Record<CoagAnalyteId, number>;

  // ── Contadores ────────────────────────────────────────────────────────────

  /** Total de corridas registradas neste lote (mantido por transação no save). */
  runCount: number;

  // ── Qualidade ─────────────────────────────────────────────────────────────

  /** Decisão formal de aceitação/rejeição do lote emitida pelo Responsável Técnico. */
  coagDecision?: CoagStatus;

  /** Status calculado automaticamente pelo hook de Westgard sobre os runs do lote. */
  lotStatus: CoagLotStatus;

  // ── Decisão Formal ────────────────────────────────────────────────────────

  /** UID do Responsável Técnico que emitiu a decisão formal de aprovação/rejeição do lote. */
  decisionBy?: string;

  /** Timestamp Firestore da decisão formal. */
  decisionAt?: import('firebase/firestore').Timestamp;

  // ── Auditoria ─────────────────────────────────────────────────────────────

  /** Timestamp Firestore de criação do documento de lote. */
  createdAt: import('firebase/firestore').Timestamp;

  /** UID do usuário que criou o documento de lote. */
  createdBy: string;
}

// ─── Re-exports para conveniência dos importers do módulo ─────────────────────

export type {
  CoagNivel,
  CoagAnalyteId,
  CoagStatus,
  CoagLotStatus,
  CoagFrequencia,
  CoagEquipamento,
};
export { COAG_ANALYTE_LABELS } from './_shared_refs';
