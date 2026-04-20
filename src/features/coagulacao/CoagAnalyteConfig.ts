/**
 * CoagAnalyteConfig.ts — Configurações canônicas de analitos de coagulação.
 *
 * Fonte dos dados: Formulário-008 do laboratório (confirmado pelo CTO).
 * Baselines derivados dos valores do material de controle Bio-Rad/Helena Biosciences
 * para os dois níveis obrigatórios conforme CLSI H21-A5 e H47-A2.
 *
 * SD estimado a partir do intervalo de aceitabilidade do fabricante:
 *   sd = (high - low) / 4
 * Assume distribuição normal com ±2σ cobrindo o intervalo [low, high] do fabricante.
 *
 * Regras Westgard aplicadas: conjunto clássico CLSI para coagulação
 * (CLSI EP6-A, CLSI C24-A3 — Statistical Quality Control for Quantitative Measurement Procedures).
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI H21-A5 · CLSI H47-A2
 */

import type { CoagAnalyteId, CoagNivel } from './types/_shared_refs';
import type { AnalyteStats, WestgardViolation } from '../../types';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Baseline estatístico por nível de controle para um analito de coagulação.
 * Os valores mean/low/high vêm da bula do material de controle (Formulário-008).
 */
export interface CoagAnalyteBaselineByLevel {
  /** Média alvo conforme bula do fabricante. */
  mean: number;
  /** Limite inferior de aceitação (mean − 2SD conforme fabricante). */
  low:  number;
  /** Limite superior de aceitação (mean + 2SD conforme fabricante). */
  high: number;
  /**
   * Desvio-padrão estimado a partir do intervalo do fabricante.
   * Calculado como `(high - low) / 4` — assume distribuição ±2σ dentro do intervalo.
   * Usado para z-score nas regras de Westgard quantitativas.
   */
  sd:   number;
  /** Unidade de medida do analito (% para AP, adimensional para RNI, "s" para TTPA). */
  unit: string;
}

/**
 * Configuração canônica de um analito de coagulação.
 * Contém metadados de exibição, regras Westgard aplicáveis e baselines por nível.
 */
export interface CoagAnalyteConfig {
  /** Identificador canônico do analito — chave de todos os maps do módulo. */
  id:       CoagAnalyteId;
  /** Label de exibição para UI e relatórios impressos. */
  label:    string;
  /**
   * Número de casas decimais para exibição em tooltip, carta de Levey-Jennings e relatório.
   * AP: 0 (inteiro %); RNI: 2 (precisão clínica relevante); TTPA: 1 (resolução de 0.1 s).
   */
  decimals: number;
  /**
   * Regras Westgard aplicáveis ao analito — subconjunto do conjunto clássico CLSI C24-A3.
   * Usado pelo hook de avaliação para filtrar quais regras checar por analito.
   */
  westgardRules: readonly WestgardViolation[];
  /** Baselines por nível de controle (I = normal, II = anticoagulado/patológico). */
  levels: Record<CoagNivel, CoagAnalyteBaselineByLevel>;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Calcula SD a partir do intervalo [low, high] do fabricante.
 * Assume distribuição normal com ±2σ cobrindo o intervalo: sd = (high - low) / 4.
 */
function estimateSd(low: number, high: number): number {
  return (high - low) / 4;
}

// ─── Regras Westgard padrão CLSI para coagulação ─────────────────────────────

/**
 * Conjunto de regras Westgard para analitos quantitativos de coagulação.
 * Conforme CLSI C24-A3 e recomendações ISTH para monitoramento de CIQ em coagulação.
 * '6T' e '6X' não incluídos — não fazem parte do conjunto MVP acordado; podem ser
 * adicionados em v2 após validação do número de runs disponíveis.
 */
const CLSI_WESTGARD_RULES: readonly WestgardViolation[] = [
  '1-2s',
  '1-3s',
  '2-2s',
  'R-4s',
  '4-1s',
  '10x',
] as const;

// ─── Configurações canônicas ──────────────────────────────────────────────────

/**
 * Dicionário canônico de todos os analitos de coagulação do módulo.
 *
 * Valores de mean/low/high: Formulário-008 do laboratório (CTO-confirmado).
 * SD calculado automaticamente como `(high - low) / 4`.
 *
 * Níveis:
 *  I  — Controle normal (valores dentro do intervalo terapêutico de referência).
 *  II — Controle anticoagulado/patológico (simula paciente em terapia ou estado protrombótico).
 */
export const COAG_ANALYTES: Record<CoagAnalyteId, CoagAnalyteConfig> = {
  atividadeProtrombinica: {
    id:            'atividadeProtrombinica',
    label:         'Atividade de Protrombina (%)',
    decimals:      0,
    westgardRules: CLSI_WESTGARD_RULES,
    levels: {
      I: {
        mean: 98,
        low:  82,
        high: 114,
        sd:   estimateSd(82, 114), // (114 - 82) / 4 = 8.0
        unit: '%',
      },
      II: {
        mean: 67,
        low:  53,
        high: 81,
        sd:   estimateSd(53, 81), // (81 - 53) / 4 = 7.0
        unit: '%',
      },
    },
  },

  rni: {
    id:            'rni',
    label:         'RNI',
    decimals:      2,
    westgardRules: CLSI_WESTGARD_RULES,
    levels: {
      I: {
        mean: 0.98,
        low:  0.82,
        high: 1.14,
        sd:   estimateSd(0.82, 1.14), // (1.14 - 0.82) / 4 = 0.08
        unit: '',
      },
      II: {
        mean: 1.20,
        low:  0.96,
        high: 1.44,
        sd:   estimateSd(0.96, 1.44), // (1.44 - 0.96) / 4 = 0.12
        unit: '',
      },
    },
  },

  ttpa: {
    id:            'ttpa',
    label:         'TTPA (s)',
    decimals:      1,
    westgardRules: CLSI_WESTGARD_RULES,
    levels: {
      I: {
        mean: 39,
        low:  31,
        high: 47,
        sd:   estimateSd(31, 47), // (47 - 31) / 4 = 4.0
        unit: 's',
      },
      II: {
        mean: 43,
        low:  35,
        high: 51,
        sd:   estimateSd(35, 51), // (51 - 35) / 4 = 4.0
        unit: 's',
      },
    },
  },
};

/**
 * Lista ordenada de IDs de analitos de coagulação — usada para iteração
 * determinística em UI, relatórios e avaliação Westgard.
 * Ordem: AP → RNI → TTPA (lógica clínica: derivação RNI depende de AP/TP).
 */
export const COAG_ANALYTE_IDS: readonly CoagAnalyteId[] = [
  'atividadeProtrombinica',
  'rni',
  'ttpa',
] as const;

// ─── Helper público ───────────────────────────────────────────────────────────

/**
 * Extrai `AnalyteStats` `{ mean, sd }` de um analito no nível informado.
 *
 * Formato esperado por `checkWestgardRules()` de `westgardRules.ts` e por
 * `useChartData` da carta de Levey-Jennings.
 *
 * @param id    Identificador canônico do analito.
 * @param nivel Nível do controle (I | II).
 * @returns     `{ mean, sd }` prontos para z-score Westgard.
 */
export function getCoagStats(id: CoagAnalyteId, nivel: CoagNivel): AnalyteStats {
  const config = COAG_ANALYTES[id];
  const level  = config.levels[nivel];
  return { mean: level.mean, sd: level.sd };
}
