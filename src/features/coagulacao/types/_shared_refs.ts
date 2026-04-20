/**
 * _shared_refs.ts — Fonte única de verdade para tipos compartilhados do módulo Coagulação.
 *
 * Importar daqui em todos os hooks, components e services do módulo.
 * NÃO duplicar estes tipos em outros arquivos do módulo.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · RDC 67/2009 + RDC 551/2021
 */

// ─── Nível de Controle ────────────────────────────────────────────────────────

/**
 * Nível do material de controle utilizado na corrida.
 *
 *  I  = Nível I — controle normal (valores dentro do intervalo terapêutico de referência).
 *  II = Nível II — controle anticoagulado/patológico (valores elevados, simula paciente
 *       em terapia anticoagulante oral ou estado protrombótico).
 *
 * Conforme CLSI H21-A5 e H47-A2: dois níveis obrigatórios para coagulação.
 */
export type CoagNivel = 'I' | 'II';

// ─── Analitos Suportados ──────────────────────────────────────────────────────

/**
 * Identificadores canônicos dos analitos de coagulação suportados no MVP.
 *
 *  atividadeProtrombinica — Atividade de Protrombina (AP/TP), expressa em %.
 *                           Derivada do tempo de protrombina via curva de calibração.
 *  rni                    — Razão Normalizada Internacional (RNI/INR), adimensional.
 *                           Calculada automaticamente a partir de TP, ISI e MNPT do lab.
 *  ttpa                   — Tempo de Tromboplastina Parcial Ativada (TTPA), em segundos.
 *
 * Analitos opcionais (Fibrinogênio, D-dímero, Fatores V/VII/VIII/IX) são v2.
 */
export type CoagAnalyteId =
  | 'atividadeProtrombinica'
  | 'rni'
  | 'ttpa';

/** Labels de exibição para cada CoagAnalyteId — usar em UI e relatórios. */
export const COAG_ANALYTE_LABELS: Record<CoagAnalyteId, string> = {
  /** Atividade de Protrombina — resultado em percentual de atividade (%). */
  atividadeProtrombinica: 'Atividade de Protrombina (%)',
  /** Razão Normalizada Internacional — adimensional, derivado de TP+ISI+MNPT. */
  rni: 'RNI',
  /** Tempo de Tromboplastina Parcial Ativada — resultado em segundos (s). */
  ttpa: 'TTPA (s)',
};

// ─── Status de Decisão do Lote ────────────────────────────────────────────────

/**
 * Decisão formal de aceitação do lote pelo Responsável Técnico.
 * Distinto do `status` da corrida individual (`RunStatus`).
 * Usar no campo `coagDecision` do documento de lote.
 *
 *  A         = Aceitável — lote dentro dos critérios RDC 978/2025.
 *  NA        = Não Aceitável — lote com falhas, mas sem reprovação formal (requer monitoramento).
 *  Rejeitado = Lote reprovado formalmente; requer investigação e registro de ação corretiva.
 */
export type CoagStatus = 'A' | 'NA' | 'Rejeitado';

// ─── Status do Lote (calculado automaticamente) ───────────────────────────────

/**
 * Status calculado pelo hook de Westgard sobre o conjunto de runs do lote.
 *
 *  valido    — Lote dentro dos limites de controle; nenhuma regra violada.
 *  atencao   — Pelo menos um alerta de aviso (ex: validade próxima, tendência).
 *  reprovado — Violação de regra de rejeição Westgard ou lote expirado.
 *  sem_dados — Nenhum run registrado; status indeterminado.
 */
export type CoagLotStatus = 'valido' | 'atencao' | 'reprovado' | 'sem_dados';

// ─── Frequência de Realização ─────────────────────────────────────────────────

/**
 * Frequência de realização do controle de qualidade.
 *
 *  DIARIA — Controle realizado uma vez por dia (padrão RDC 302/2005).
 *  LOTE   — Controle vinculado à troca de lote de reagente.
 */
export type CoagFrequencia = 'DIARIA' | 'LOTE';

// ─── Equipamento ──────────────────────────────────────────────────────────────

/**
 * Coagulômetro utilizado no laboratório.
 * Literal único por ora — confirmar antes de adicionar novos modelos.
 *
 *  'Clotimer Duo' — Coagulômetro óptico semi-automático (equipamento atual do lab).
 */
export type CoagEquipamento = 'Clotimer Duo';
