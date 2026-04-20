import type { CQRun } from '../../../types';
import type {
  UroNivel,
  UroFrequencia,
  UroStatus,
  UroLotStatus,
  UroFieldOrigem,
  UroAnalitoCategoricoId,
  UroAnalitoQuantitativoId,
  UroAnalitoId,
  UroValorCategorico,
  UroAlert,
} from './_shared_refs';

// ─── Campo com Auditoria de Origem ────────────────────────────────────────────

/**
 * Wrapper de auditoria para qualquer campo de resultado de uroanálise.
 *
 * Rastreia a origem do valor (manual vs OCR/IA) para fins regulatórios e
 * para calcular métricas de qualidade do pipeline de OCR quando implementado.
 *
 * @template T — tipo do valor capturado (UroValorCategorico, number, etc.)
 */
export interface UroFieldAuditado<T> {
  /**
   * Valor do campo; `null` quando o analito existe na tira mas não foi preenchido
   * (operador pulou ou OCR não conseguiu ler).
   */
  valor: T | null;

  /** Origem do preenchimento — determina se houve intervenção de IA e em que grau. */
  origem: UroFieldOrigem;

  /**
   * Confiança da leitura por OCR/IA, no intervalo [0, 1].
   * Presente apenas quando `origem` começa com 'OCR_' (ACEITO, EDITADO ou REJEITADO).
   * Abaixo de 0.7 sugere revisão obrigatória pelo operador.
   */
  ocrConfianca?: number;
}

// ─── Run (Corrida Individual) ─────────────────────────────────────────────────

/**
 * UroanaliseRun — corrida auditável de controle de qualidade para uroanálise
 * por tiras reagentes.
 *
 * Estende CQRun omitindo campos do fluxo quantitativo de IA (analyzer/hematologia)
 * que não se aplicam ao módulo híbrido de uroanálise.
 *
 * Campos omitidos:
 *  - westgardViolations  → uroanálise usa lógica ordinal categórica, não z-score
 *  - level               → uroanálise usa UroNivel ('N' | 'P'), não 1 | 2 | 3
 *  - aiData              → mapa de analitos numéricos da IA — gerenciado via UroFieldAuditado
 *  - aiConfidence        → confiança por analito — encapsulada em UroFieldAuditado.ocrConfianca
 *  - confirmedData       → mapa de valores confirmados — substituído por `resultados`
 *  - editedFields        → controle de edição por analito — encapsulado em UroFieldAuditado.origem
 *  - originalData        → snapshot de valores originais — encapsulado em UroFieldAuditado
 *
 * Firestore path: labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 67/2009 + RDC 551/2021
 * Referências: CLSI GP16-A3 · European Urinalysis Guidelines (EUG) · CLSI AUTO10-A
 */
export interface UroanaliseRun extends Omit<CQRun,
  | 'westgardViolations'
  | 'level'
  | 'aiData'
  | 'aiConfidence'
  | 'confirmedData'
  | 'editedFields'
  | 'originalData'
> {
  // ── Identificação ──────────────────────────────────────────────────────────

  /** Código sequencial da corrida — formato UR-YYYY-NNNN (gerado por transação Firestore). */
  runCode: string;

  /** Nível do material de controle: N = normal/negativo, P = patológico/elevado. */
  nivel: UroNivel;

  /** Frequência de realização do controle: diária ou vinculada à abertura de lote de tiras. */
  frequencia: UroFrequencia;

  /**
   * Marca da tira reagente utilizada.
   * Determina quais parâmetros estão disponíveis e o formulário renderizado.
   * Ex: "Combur-10", "Multistix-10SG", "Bioeasy-10".
   */
  tiraMarca?: string;

  // ── Insumos ───────────────────────────────────────────────────────────────

  /** Número do lote das tiras reagentes utilizadas (rastreabilidade RDC 36/2015). */
  loteTira: string;

  /** Fabricante das tiras reagentes (ex: "Roche", "Siemens", "Bioeasy"). */
  fabricanteTira?: string;

  /** Data de validade das tiras reagentes (YYYY-MM-DD). */
  validadeTira?: string;

  /** Número do lote do material de controle urinário utilizado. */
  loteControle: string;

  /** Fabricante do material de controle urinário (ex: "Bio-Rad", "Randox"). */
  fabricanteControle: string;

  /**
   * Data de abertura do frasco de controle (YYYY-MM-DD).
   * Controles líquidos têm estabilidade limitada pós-abertura — consultar bula.
   */
  aberturaControle: string;

  /** Data de validade do controle urinário (YYYY-MM-DD). */
  validadeControle: string;

  // ── Ambiente ──────────────────────────────────────────────────────────────

  /** Temperatura ambiente no momento da realização, em graus Celsius (°C). */
  temperaturaAmbiente?: number;

  /** Umidade relativa do ar no momento da realização, em percentual (%). */
  umidadeAmbiente?: number;

  // ── Data ──────────────────────────────────────────────────────────────────

  /** Data de realização da corrida no formato YYYY-MM-DD. */
  dataRealizacao: string;

  // ── Resultados Esperados ──────────────────────────────────────────────────

  /**
   * Valores alvo por analito, conforme bula do material de controle.
   * Usados para avaliação de conformidade (obtido vs esperado ± tolerância ordinal).
   *
   * Categóricos: valor exato esperado (ex: 'NEGATIVO', '1+').
   * pH e densidade: faixa aceitável {min, max} conforme bula ou procedimento do lab.
   *
   * `Partial` porque nem toda tira inclui todos os parâmetros.
   */
  resultadosEsperados: Partial<{
    /** Urobilinogênio esperado: tipicamente 'NORMAL' para nível N, 'AUMENTADO' para nível P. */
    urobilinogenio: UroValorCategorico;
    /** Glicose esperada: tipicamente 'NEGATIVO' para nível N. */
    glicose:        UroValorCategorico;
    /** Cetonas esperadas: tipicamente 'NEGATIVO' para nível N. */
    cetonas:        UroValorCategorico;
    /** Bilirrubina esperada: tipicamente 'NEGATIVO' para nível N. */
    bilirrubina:    UroValorCategorico;
    /** Proteína esperada: tipicamente 'NEGATIVO' ou 'TRACOS' para nível N. */
    proteina:       UroValorCategorico;
    /** Nitrito esperado: tipicamente 'NEGATIVO' para nível N. */
    nitrito:        UroValorCategorico;
    /** Sangue oculto esperado: tipicamente 'NEGATIVO' para nível N. */
    sangue:         UroValorCategorico;
    /** Leucócitos esperados: tipicamente 'NEGATIVO' para nível N. */
    leucocitos:     UroValorCategorico;
    /** pH esperado: faixa aceitável em unidades de pH (5.0–8.5, passo 0.5). */
    ph:             { min: number; max: number };
    /** Densidade esperada: faixa aceitável (1.000–1.030, passo 0.005). */
    densidade:      { min: number; max: number };
  }>;

  // ── Resultados Obtidos ────────────────────────────────────────────────────

  /**
   * Valores obtidos por analito, cada um envolvido em UroFieldAuditado para rastreio de origem.
   *
   * Campos opcionais porque nem toda tira inclui todos os parâmetros, e o operador
   * pode não preencher todos os campos disponíveis em uma corrida.
   *
   * pH e densidade são numéricos — avaliados contra a faixa {min, max} de `resultadosEsperados`.
   * Demais analitos são categóricos — avaliados com tolerância ±1 nível ordinal (CLSI GP16-A3).
   */
  resultados: {
    /** Urobilinogênio obtido (escala NORMAL / AUMENTADO / 1+ / 2+ / 3+). */
    urobilinogenio?: UroFieldAuditado<UroValorCategorico>;
    /** Glicose obtida (escala NEGATIVO / 1+ / 2+ / 3+ / 4+). */
    glicose?:        UroFieldAuditado<UroValorCategorico>;
    /** Cetonas obtidas (escala NEGATIVO / TRACOS / 1+ / 2+ / 3+). */
    cetonas?:        UroFieldAuditado<UroValorCategorico>;
    /** Bilirrubina obtida (escala NEGATIVO / 1+ / 2+ / 3+). */
    bilirrubina?:    UroFieldAuditado<UroValorCategorico>;
    /** Proteína obtida (escala NEGATIVO / TRACOS / 1+ / 2+ / 3+ / 4+). */
    proteina?:       UroFieldAuditado<UroValorCategorico>;
    /** Nitrito obtido (NEGATIVO = ausente; PRESENTE = bacteriúria significativa). */
    nitrito?:        UroFieldAuditado<UroValorCategorico>;
    /** Sangue oculto obtido (escala NEGATIVO / TRACOS / 1+ / 2+ / 3+). */
    sangue?:         UroFieldAuditado<UroValorCategorico>;
    /** Leucócitos obtidos (escala NEGATIVO / TRACOS / 1+ / 2+ / 3+). */
    leucocitos?:     UroFieldAuditado<UroValorCategorico>;
    /** pH urinário obtido (valor numérico; escala ordinal 5.0–8.5). */
    ph?:             UroFieldAuditado<number>;
    /** Densidade urinária obtida (valor numérico; escala 1.000–1.030). */
    densidade?:      UroFieldAuditado<number>;
  };

  // ── Conformidade ──────────────────────────────────────────────────────────

  /**
   * Decisão de conformidade da corrida.
   *
   *  A = Aceitável — todos os analitos avaliados dentro da tolerância ordinal.
   *  R = Rejeitado — pelo menos um analito com desvio >1 nível ordinal (requer ação corretiva).
   */
  conformidade: 'A' | 'R';

  /**
   * Analitos que apresentaram não conformidade nesta corrida (desvio >1 nível ordinal).
   * Array vazio quando `conformidade === 'A'`.
   */
  analitosNaoConformes: UroAnalitoId[];

  /**
   * Descrição da ação corretiva tomada pelo operador ou RT.
   * Obrigatória quando `conformidade === 'R'` — RDC 978/2025 Art. 128.
   */
  acaoCorretiva?: string;

  /**
   * Alertas de qualidade calculados pelo hook de avaliação do lote.
   * Análogos ao westgardCategorico do ciq-imuno, adaptados para avaliação ordinal.
   */
  alertas?: UroAlert[];

  // ── Notificação Sanitária (RDC 67/2009 + RDC 551/2021 — Tecnovigilância) ──

  /**
   * Tipo de ocorrência de tecnovigilância a ser notificada ao NOTIVISA 2.0.
   * Aplicável quando `conformidade === 'R'` e a causa envolve produto (tira ou controle).
   *
   *  queixa_tecnica — Desvio de qualidade do produto sem dano ao paciente.
   *                   Ex: tira com reatividade alterada por armazenamento inadequado.
   *  evento_adverso — Resultado de CIQ comprometido que afetou conduta clínica ou causou dano.
   *
   * Referência: RDC 67/2009 Art. 4º e RDC 551/2021.
   */
  notivisaTipo?: 'queixa_tecnica' | 'evento_adverso';

  /**
   * Status formal da notificação ao NOTIVISA 2.0.
   *
   *  pendente   — Não conformidade aberta; aguardando decisão do RT.
   *  notificado — Submetido ao NOTIVISA; protocolo retornado e registrado.
   *  dispensado — Causa raiz operacional (não defeito de produto); exige justificativa.
   *
   * Referência: RDC 67/2009 + RDC 551/2021.
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
   * Fica arquivada como evidência regulatória — RDC 551/2021.
   */
  notivisaJustificativa?: string;

  // ── Operador ──────────────────────────────────────────────────────────────

  /**
   * Nome de exibição do operador responsável pela corrida.
   * Redundante com `operatorName` herdado de CQRun, mas explicitado para
   * queries Firestore sem join e para o relatório impresso.
   */
  responsavel?: string;
}

// ─── Lote ─────────────────────────────────────────────────────────────────────

/**
 * UroanaliseLot — lote de controle para o módulo de uroanálise.
 *
 * Documento raiz em labs/{labId}/ciq-uroanalise/{lotId}.
 * Cada combinação (loteControle × nivel) é um documento de lote independente.
 * As corridas ficam na subcoleção /runs — nunca embutidas no documento.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 36/2015 (rastreabilidade).
 */
export interface UroanaliseLot {
  /** UID do documento Firestore (gerado automaticamente). */
  id: string;

  /** UID do laboratório — chave de multi-tenancy. */
  labId: string;

  // ── Identificação ──────────────────────────────────────────────────────────

  /** Nível do controle: N = normal/negativo, P = patológico/elevado. */
  nivel: UroNivel;

  /** Número do lote do material de controle urinário. */
  loteControle: string;

  /** Fabricante do material de controle urinário. */
  fabricanteControle: string;

  /** Data de abertura do lote de controle (YYYY-MM-DD). */
  aberturaControle: string;

  /** Data de validade do lote de controle (YYYY-MM-DD). */
  validadeControle: string;

  // ── Alvos do Material ─────────────────────────────────────────────────────

  /**
   * Snapshot dos resultados esperados conforme bula do material de controle.
   * Reutiliza o shape de `UroanaliseRun['resultadosEsperados']` para consistência.
   * Serve como referência rápida sem precisar abrir um run individual.
   */
  resultadosEsperados?: UroanaliseRun['resultadosEsperados'];

  // ── Contadores ────────────────────────────────────────────────────────────

  /** Total de corridas registradas neste lote (mantido por transação no save). */
  runCount: number;

  // ── Qualidade ─────────────────────────────────────────────────────────────

  /** Decisão formal de aceitação/rejeição do lote emitida pelo Responsável Técnico. */
  uroDecision?: UroStatus;

  /** UID do Responsável Técnico que emitiu a decisão formal. */
  decisionBy?: string;

  /** Timestamp Firestore da decisão formal. */
  decisionAt?: import('firebase/firestore').Timestamp;

  /** Status calculado automaticamente pelo hook de avaliação sobre os runs do lote. */
  lotStatus: UroLotStatus;

  // ── Auditoria ─────────────────────────────────────────────────────────────

  /** Timestamp Firestore de criação do documento de lote. */
  createdAt: import('firebase/firestore').Timestamp;

  /** UID do usuário que criou o documento de lote. */
  createdBy: string;
}

// ─── Re-exports para conveniência dos importers do módulo ─────────────────────

export type {
  UroNivel,
  UroFrequencia,
  UroStatus,
  UroLotStatus,
  UroFieldOrigem,
  UroAnalitoCategoricoId,
  UroAnalitoQuantitativoId,
  UroAnalitoId,
  UroValorCategorico,
  UroAlert,
};
