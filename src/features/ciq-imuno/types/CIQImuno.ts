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
  /**
   * Resultado esperado pelo controle (definido pelo fabricante).
   *
   * Em corridas de **analisador**, é o esperado da corrida (operador escolhe).
   * Em corridas **manuais com kit P+N** (Fase G — 2026-04-25), espelha o
   * esperado do **controle positivo** (deriva de `controlePositivo.nivel`:
   * `positivo` → `R`).
   */
  resultadoEsperado: 'R' | 'NR';
  /**
   * Resultado obtido na corrida — R = Reagente, NR = Não Reagente.
   *
   * Em modo manual, espelha o **obtido do controle positivo**.
   */
  resultadoObtido: 'R' | 'NR';
  /**
   * Fase G (2026-04-25) — em corridas manuais com kit P+N, captura o par
   * **negativo**: esperado deriva de `controleNegativo.nivel` (`negativo` →
   * `NR`); obtido é a leitura do operador. Ausente em corridas de analisador
   * (que rodam apenas o reagente, sem par P/N na corrida).
   *
   * Veredito da corrida em modo manual:
   * `positivoConforme && negativoConforme`. Qualquer divergência → 'Rejeitada'
   * + ação corretiva obrigatória (RDC 978/2025 Art.128).
   */
  resultadoEsperadoNegativo?: 'R' | 'NR';
  resultadoObtidoNegativo?: 'R' | 'NR';
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
   * Snapshot imutável do insumo ativo.
   *
   * Imuno analisador: `reagente` é o único slot populado — CQ por lote, não
   * por corrida.
   *
   * Imuno manual (Fase F 2026-04-24): kits manuais (PCR látex, VDRL lâmina,
   * cartela imuno) incluem `controlePositivo` + `controleNegativo` do próprio
   * kit rodando junto com o reagente. Em corridas manuais esses três devem
   * ser capturados no snapshot — o Westgard categórico passa a avaliar
   * consistência entre esperado e obtido dos controles como parte da corrida.
   */
  insumosSnapshot?: {
    reagente?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
    controlePositivo?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
    controleNegativo?: import('../../insumos/types/InsumoSnapshot').InsumoSnapshot;
  };

  /**
   * Fase F (2026-04-24) — true quando a corrida foi realizada como teste
   * manual (kit lido a olho, sem analisador). Se `true`: `equipamentoId` e
   * `equipamentoSnapshot` ficam vazios; `insumosSnapshot` traz os kits do
   * `ManualKitPicker`. Ausente/false em runs de analisador.
   */
  manual?: boolean;

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

  // ── PR1 (2026-04-26) — Qualificação formal de insumos ─────────────────────
  // Campos populados EXCLUSIVAMENTE pela callable `approveQualificacao`
  // (Admin SDK). NÃO entram no payload canônico de `useCIQSignature` —
  // adicioná-los à canônica invalidaria assinaturas históricas. Vide
  // `useCIQSignature.generateSignature` — o objeto canônico inclui apenas
  // {doc, lot, test, ctrl, res, date}; `qualificacaoId` e `usadaComoEvidencia`
  // ficam fora deliberadamente.

  /**
   * ID da `InsumoQualificacao` que usou esta corrida como evidência. Quando
   * preenchido, indica que a corrida fez parte do conjunto que aprovou
   * formalmente um lote (RDC 978/2025 Art.128).
   */
  qualificacaoId?: string;

  /**
   * `true` quando esta corrida foi marcada como evidência analítica em uma
   * qualificação aprovada. Mutação SOMENTE pelo Admin SDK na callable
   * `approveQualificacao`. Não muda `classificacaoImuno` (esse campo é
   * imutável após criação do run).
   */
  usadaComoEvidencia?: boolean;
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
  /**
   * Justificativa registrada pelo RT no momento da decisão formal.
   * Obrigatória para rastreabilidade RDC 786 — capturada no modal de decisão
   * com reauth, e gravada junto a `ciqDecision` (audit record imutável em
   * `ciq-imuno/{lotId}/audit/`).
   */
  decisionJustificativa?: string;

  // ── Auditoria ─────────────────────────────────────────────────────────────
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string;

  // ── Vinculação à Bancada (Fase 1A — 2026-04-25) ──────────────────────────
  /**
   * Setup vinculado à bancada — destrava registro de corridas para esse
   * lote sem fricção de selecionar manualmente.
   *  - 'principal': lote em rotina (uso-normal). Requer qcStatus aprovado.
   *  - 'validacao_paralela': lote em validação. Corridas viram classificacaoImuno='validacao'.
   *  - null/ausente: lote no estoque, não vinculado.
   */
  setupType?: 'principal' | 'validacao_paralela' | null;
  /** UID do operador que vinculou. Null/ausente quando setupType é null. */
  pinnedBy?: string | null;
  /** Timestamp da última vinculação ativa. */
  pinnedAt?: import('firebase/firestore').Timestamp | null;
  /**
   * Histórico imutável de operações de vinculação. Append-only via transação.
   * Cobre RDC 786 — toda mudança de vinculação rastreável.
   */
  pinHistory?: Array<{
    at: import('firebase/firestore').Timestamp;
    by: string;
    action: 'vinculado' | 'desvinculado';
    setupType?: 'principal' | 'validacao_paralela';
    prevSetupType?: 'principal' | 'validacao_paralela';
  }>;
}

// ─── Re-exports para conveniência dos importers do módulo ─────────────────────

export type { TestType, WestgardCatAlert, CIQStatus, CIQLotStatus };
