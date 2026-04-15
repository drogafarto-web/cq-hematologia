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
export interface CIQImunoRun extends Omit<CQRun,
  | 'westgardViolations'
  | 'level'
  | 'aiData'
  | 'aiConfidence'
  | 'confirmedData'
  | 'editedFields'
  | 'originalData'
> {
  // ── Identificação do teste ────────────────────────────────────────────────
  testType: TestType;

  // ── Controle interno ──────────────────────────────────────────────────────
  /** Número do lote do material de controle (ex: "L2024-001") */
  loteControle: string;
  /** Data de abertura do frasco de controle (YYYY-MM-DD) */
  aberturaControle: string;
  /** Data de validade do controle (YYYY-MM-DD) */
  validadeControle: string;

  // ── Reagente ──────────────────────────────────────────────────────────────
  /** Número do lote do reagente utilizado */
  loteReagente: string;
  /**
   * Status de reatividade do reagente na abertura.
   * 'NR' na abertura inviabiliza o uso para testes de CIQ Reagentes.
   */
  reagenteStatus: 'R' | 'NR';
  /** Data de abertura do kit reagente (YYYY-MM-DD) */
  aberturaReagente: string;
  /** Data de validade do reagente (YYYY-MM-DD) */
  validadeReagente: string;

  // ── Resultado ─────────────────────────────────────────────────────────────
  /** Resultado esperado pelo controle (definido pelo fabricante) */
  resultadoEsperado: 'R' | 'NR';
  /** Resultado obtido na corrida — R = Reagente, NR = Não Reagente */
  resultadoObtido: 'R' | 'NR';
  /** Data em que o teste foi realizado (YYYY-MM-DD) */
  dataRealizacao: string;

  // ── Qualidade ─────────────────────────────────────────────────────────────
  /** Alertas Westgard categóricos calculados pelo useCIQWestgard no momento do save */
  westgardCategorico?: WestgardCatAlert[];

  // ── OCR / IA ──────────────────────────────────────────────────────────────
  /** Confiança da leitura por IA do strip ('high' | 'medium' | 'low') */
  aiStripConfidence?: 'high' | 'medium' | 'low';
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

  // ── Auditoria ─────────────────────────────────────────────────────────────
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string;
}

// ─── Re-exports para conveniência dos importers do módulo ─────────────────────

export type { TestType, WestgardCatAlert, CIQStatus, CIQLotStatus };
