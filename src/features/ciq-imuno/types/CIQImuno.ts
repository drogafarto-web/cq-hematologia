import type { CQRun } from '../../../types';
import type { TestType, WestgardCatAlert, CIQStatus, CIQLotStatus } from './_shared_refs';

// ─── Run (Corrida Individual) ─────────────────────────────────────────────────

/**
 * CIQImunoRun — corrida auditável de controle de qualidade para imunoensaios.
 *
 * Estende CQRun omitindo campos exclusivos de analitos quantitativos
 * (hematologia/bioquímica) que não existem em imunoensaios categóricos R/NR.
 *
 * Campos omitidos:
 *  - westgardViolations  → substituído por westgardCategorico (R/NR, não z-score)
 *  - level               → imuno não usa níveis 1/2/3 de controle quantitativo
 *  - aiData              → analitos numéricos — inexistente em imunoensaio
 *  - aiConfidence        → confiança por analito — substituída por confidence do OCR service
 *  - confirmedData       → mapa de valores confirmados numéricos — inaplicável
 *  - editedFields        → controle de edição de analitos numéricos — inaplicável
 *  - originalData        → valores originais de analitos — inaplicável
 *
 * Firestore path: labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
 */
export interface CIQImunoRun extends Omit<
  CQRun,
  | 'westgardViolations'
  | 'level'
  | 'aiData'
  | 'aiConfidence'
  | 'confirmedData'
  | 'editedFields'
  | 'originalData'
> {
  // ── Identificação ─────────────────────────────────────────────────────────
  /** Código sequencial da corrida — CI-YYYY-NNNN (gerado por transação Firestore) */
  runCode: string;
  testType: TestType;

  // ── Controle interno ──────────────────────────────────────────────────────
  /** Número do lote do material de controle (ex: "L2024-001") */
  loteControle: string;
  /** Fabricante do material de controle */
  fabricanteControle: string;
  /** Data de abertura do frasco de controle (YYYY-MM-DD) */
  aberturaControle: string;
  /** Data de validade do controle (YYYY-MM-DD) */
  validadeControle: string;

  // ── Reagente ──────────────────────────────────────────────────────────────
  /** Número do lote do reagente utilizado */
  loteReagente: string;
  /** Fabricante do kit reagente */
  fabricanteReagente: string;
  /**
   * Status de reatividade do reagente na abertura.
   * 'NR' na abertura inviabiliza o uso para testes de CIQ Reagentes.
   */
  reagenteStatus: 'R' | 'NR';
  /** Data de abertura do kit reagente (YYYY-MM-DD) */
  aberturaReagente: string;
  /** Data de validade do reagente (YYYY-MM-DD) */
  validadeReagente: string;
  /** Código do kit / referência do fabricante */
  codigoKit?: string;
  /** Número de registro ANVISA do kit reagente */
  registroANVISA?: string;

  // ── Resultado ─────────────────────────────────────────────────────────────
  /** Resultado esperado pelo controle (definido pelo fabricante) */
  resultadoEsperado: 'R' | 'NR';
  /** Resultado obtido na corrida — R = Reagente, NR = Não Reagente */
  resultadoObtido: 'R' | 'NR';
  /** Data em que o teste foi realizado (YYYY-MM-DD) */
  dataRealizacao: string;
  /**
   * Ação corretiva tomada quando resultadoObtido ≠ resultadoEsperado.
   * Obrigatória em caso de não conformidade (RDC 978/2025 Art.128).
   */
  acaoCorretiva?: string;

  // ── Equipamento ───────────────────────────────────────────────────────────
  /** Identificador do equipamento / analisador utilizado */
  equipamento?: string;
  /** Temperatura ambiente no momento da realização (°C) */
  temperaturaAmbiente?: number;

  // ── Qualidade ─────────────────────────────────────────────────────────────
  /** Alertas Westgard categóricos calculados pelo useCIQWestgard no momento do save */
  westgardCategorico?: WestgardCatAlert[];

  // ── Notificação sanitária (RDC 67/2009 + RDC 551/2021) ────────────────────
  /**
   * Aplicável apenas quando resultadoObtido ≠ resultadoEsperado.
   *
   * - queixa_tecnica: desvio de qualidade do produto (kit, controle) sem dano
   * - evento_adverso: resultado afetou conduta clínica ou causou dano
   */
  notivisaTipo?: 'queixa_tecnica' | 'evento_adverso';
  /**
   * Status formal da notificação ao NOTIVISA.
   *
   * - pendente:   não conformidade aberta, ainda não decidida
   * - notificado: submetido com protocolo retornado
   * - dispensado: causa raiz foi operacional (não defeito de produto) —
   *               exige justificativa
   */
  notivisaStatus?: 'pendente' | 'notificado' | 'dispensado';
  /** Protocolo retornado pelo NOTIVISA 2.0 após submissão */
  notivisaProtocolo?: string;
  /** Data de envio ao NOTIVISA (YYYY-MM-DD) */
  notivisaDataEnvio?: string;
  /** Justificativa obrigatória quando notivisaStatus = 'dispensado' */
  notivisaJustificativa?: string;

  // ── OCR / IA ──────────────────────────────────────────────────────────────
  /** Confiança da leitura por IA do strip ('high' | 'medium' | 'low') */
  aiStripConfidence?: 'high' | 'medium' | 'low';

  // ── Rastreabilidade de insumos (Fase B1 — 2026-04-21) ─────────────────────

  /**
   * Snapshot imutável do insumo ativo. Imuno NÃO usa controle por corrida —
   * CQ é feito por lote (ver `Insumo.qcStatus`). Slots controle/tira ficam
   * ausentes legitimamente aqui; se algum dia o lab adotar controle por
   * corrida, o slot `controle` fica disponível para popular.
   */
  insumosSnapshot?: {
    reagente?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
  };

  /**
   * Classificação da corrida em Imuno:
   *   - 'validacao' — executada enquanto o insumo tinha qcStatus ≠ 'aprovado'.
   *     Contribui para a aprovação posterior do lote.
   *   - 'uso-normal' — pós-aprovação, rotina.
   * Ausente em dados legados — tratamento padrão é 'uso-normal'.
   */
  classificacaoImuno?: 'validacao' | 'uso-normal';

  /** Flags de override — ver CoagulacaoRun para semântica. */
  insumoVencidoOverride?: boolean;
  qcNaoValidado?: boolean;
  overrideMotivo?: string;

  // ── Rastreabilidade de equipamento (Fase D — 2026-04-21) ──────────────────

  /** ID do equipamento em que a corrida foi realizada. Nulo em runs pré-Fase D. */
  equipamentoId?: string;
  /** Snapshot imutável do equipamento — sobrevive a aposentadoria + cleanup. */
  equipamentoSnapshot?: import('../../equipamentos/types/Equipamento').EquipamentoSnapshot;
}

// ─── Lote ─────────────────────────────────────────────────────────────────────

/**
 * CIQImunoLot — lote de controle para imunoensaios.
 *
 * Documento raiz em labs/{labId}/ciq-imuno/{lotId}.
 * As corridas ficam na subcoleção /runs (não embutidas no documento).
 */
export interface CIQImunoLot {
  id: string;
  labId: string;

  // ── Identificação ─────────────────────────────────────────────────────────
  testType: TestType;
  loteControle: string;
  /** Data de abertura do lote de controle (YYYY-MM-DD) */
  aberturaControle: string;
  /** Data de validade do lote de controle (YYYY-MM-DD) */
  validadeControle: string;

  // ── Contadores ────────────────────────────────────────────────────────────
  runCount: number;

  // ── Qualidade ─────────────────────────────────────────────────────────────
  /** Decisão formal de aceitação/rejeição do lote pelo responsável técnico */
  ciqDecision?: CIQStatus;
  /** Status calculado automaticamente pelo useCIQWestgard */
  lotStatus: CIQLotStatus;

  // ── Decisão formal ────────────────────────────────────────────────────────
  /** UID do responsável técnico que emitiu a decisão formal de aprovação/rejeição */
  decisionBy?: string;
  /** Timestamp da decisão formal */
  decisionAt?: import('firebase/firestore').Timestamp;

  // ── Auditoria ─────────────────────────────────────────────────────────────
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string;
}

// ─── Re-exports para conveniência dos importers do módulo ─────────────────────

export type { TestType, WestgardCatAlert, CIQStatus, CIQLotStatus };
