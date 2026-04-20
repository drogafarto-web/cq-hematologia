/**
 * useCoagWestgard.ts — Avaliação Westgard quantitativa para o módulo de coagulação.
 *
 * Exporta:
 *  - `computeCoagWestgard` — função pura (usável fora de componentes React, ex: no save flow).
 *  - `useCoagWestgard`     — hook React memoizado sobre a função pura.
 *
 * Padrão espelhado de `useCIQWestgard.ts` (módulo ciq-imuno).
 *
 * Regras Westgard avaliadas: subconjunto CLSI C24-A3 definido por analito em `CoagAnalyteConfig`.
 * Iteração cronológica mantendo histórico newest-first por analito (janela máx: 10 valores).
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI C24-A3 · CLSI H21-A5 · CLSI H47-A2
 */

import { useMemo } from 'react';
import { checkWestgardRules, isRejection } from '../../chart/utils/westgardRules';
import { COAG_ANALYTES, COAG_ANALYTE_IDS, getCoagStats } from '../CoagAnalyteConfig';
import type { CoagulacaoRun } from '../types/Coagulacao';
import type { CoagAnalyteId, CoagNivel, CoagLotStatus } from '../types/_shared_refs';
import type { WestgardViolation } from '../../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Resultado de avaliação Westgard de uma única corrida de coagulação.
 * Contém violações por analito e estado de conformidade derivado.
 */
export interface CoagRunViolations {
  /** ID da corrida avaliada. */
  runId: string;
  /**
   * Violações de Westgard por analito nesta corrida.
   * Array vazio = analito conforme.
   */
  violationsByAnalyte: Record<CoagAnalyteId, WestgardViolation[]>;
  /**
   * Lista agregada e deduplicada das violações de todos os analitos da corrida.
   * Útil para exibição no card de corrida e para persistência em `westgardViolations`.
   */
  allViolations: WestgardViolation[];
  /** Analitos que violaram pelo menos uma regra de rejeição nesta corrida. */
  analitosComViolacao: CoagAnalyteId[];
  /**
   * Conformidade derivada da corrida:
   *  'R' — Corrida rejeitada; pelo menos um analito violou uma regra de rejeição.
   *  'A' — Corrida aceitável; nenhuma regra de rejeição violada (pode haver warnings).
   */
  conformidade: 'A' | 'R';
}

/**
 * Resultado agregado de avaliação Westgard de um lote de coagulação.
 */
export interface CoagWestgardResult {
  /** Mapa runId → avaliação de violações (toda corrida avaliada está neste mapa). */
  byRun: Map<string, CoagRunViolations>;
  /** Status calculado do lote com base no conjunto completo de runs e alertas. */
  lotStatus: CoagLotStatus;
  /**
   * Alertas de nível de lote (complementam as violações por corrida):
   *  'lote_expirado' — `validadeControle` anterior a hoje → lotStatus: reprovado.
   *  'validade_30d'  — `validadeControle` expira em menos de 30 dias → lotStatus: atencao.
   */
  lotAlerts: Array<'lote_expirado' | 'validade_30d'>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Janela máxima de valores históricos por analito para regras multi-ponto (10x). */
const HISTORY_WINDOW = 10;

/** Dias antes da validade que ativa alerta de proximidade (DAYS_EXPIRY_WARNING). */
const DAYS_EXPIRY_WARNING = 30;

// ─── Helper: daysToExpiry ─────────────────────────────────────────────────────

/**
 * Calcula a diferença em dias inteiros entre hoje e uma data de validade.
 * Negativo = já expirado.
 *
 * Usa `new Date(y, m, d)` para parse local — evita o deslocamento de fuso
 * causado por `new Date('YYYY-MM-DD')` que interpreta a string como UTC midnight,
 * resultando em datas erradas em timezones UTC-N (ex: UTC-3 no Brasil).
 *
 * Copiado de `CIQImunoForm.schema.ts` — mesma lógica, sem dep cruzada entre módulos.
 */
function daysToExpiry(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const expiry = new Date(y, m - 1, d, 0, 0, 0, 0); // local midnight

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Pure computation ─────────────────────────────────────────────────────────

/**
 * Avalia Westgard quantitativamente sobre um conjunto de runs do MESMO lote
 * (já filtrados por loteControle + nivel).
 *
 * Iteração cronológica (oldest → newest) mantendo histórico por analito para
 * permitir que regras multi-ponto (2-2s, R-4s, 4-1s, 10x) tenham contexto adequado.
 * Histórico armazenado newest-first (índice 0 = valor mais recente anterior ao atual)
 * — formato esperado por `checkWestgardRules` de `westgardRules.ts`.
 *
 * Regras avaliadas: definidas por analito em `COAG_ANALYTES[id].westgardRules`
 * (subconjunto CLSI C24-A3: 1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x).
 *
 * @param runs             Corridas do lote em qualquer ordem (ordenadas internamente por dataRealizacao asc).
 * @param nivel            Nível do lote (I | II) — determina qual baseline mean/SD usar.
 * @param validadeControle Data de validade do controle no formato YYYY-MM-DD.
 * @returns                `CoagWestgardResult` com mapa por corrida, status do lote e alertas.
 */
export function computeCoagWestgard(
  runs: CoagulacaoRun[],
  nivel: CoagNivel,
  validadeControle: string,
): CoagWestgardResult {
  // ── Step 1: resultado imediato para lote sem dados ───────────────────────────
  if (runs.length === 0) {
    return {
      byRun:     new Map(),
      lotStatus: 'sem_dados',
      lotAlerts: [],
    };
  }

  // ── Step 2: ordenar cronologicamente (oldest → newest) ───────────────────────
  const sorted = [...runs].sort(
    (a, b) => new Date(a.dataRealizacao).getTime() - new Date(b.dataRealizacao).getTime(),
  );

  // ── Step 3: histórico por analito (newest-first, cap: HISTORY_WINDOW) ────────
  // Inicializado vazio; cresce a cada run processado.
  const historyByAnalyte: Record<CoagAnalyteId, number[]> = {
    atividadeProtrombinica: [],
    rni:                    [],
    ttpa:                   [],
  };

  // ── Step 4: mapa de resultados por corrida ────────────────────────────────────
  const byRun = new Map<string, CoagRunViolations>();

  for (const run of sorted) {
    const violationsByAnalyte = {} as Record<CoagAnalyteId, WestgardViolation[]>;

    for (const analyteId of COAG_ANALYTE_IDS) {
      const value   = run.resultados[analyteId];
      const stats   = getCoagStats(analyteId, nivel);
      const history = historyByAnalyte[analyteId];

      // Filtra apenas as regras configuradas para este analito
      const applicableRules = COAG_ANALYTES[analyteId].westgardRules;
      const allViolsForAnalyte = checkWestgardRules(value, history, stats);
      const filtered = allViolsForAnalyte.filter((v) =>
        (applicableRules as readonly string[]).includes(v),
      );

      violationsByAnalyte[analyteId] = filtered;

      // Atualizar histórico: adicionar valor no início (newest-first), limitar a HISTORY_WINDOW
      history.unshift(value);
      if (history.length > HISTORY_WINDOW) {
        history.pop();
      }
    }

    // ── Agregar violações da corrida ────────────────────────────────────────────
    const allViolsSets = Object.values(violationsByAnalyte).flat();
    // Deduplica mantendo ordem de aparição
    const allViolations = [...new Set(allViolsSets)] as WestgardViolation[];

    const analitosComViolacao = (Object.keys(violationsByAnalyte) as CoagAnalyteId[]).filter(
      (id) => isRejection(violationsByAnalyte[id]),
    );

    const conformidade: 'A' | 'R' = analitosComViolacao.length > 0 ? 'R' : 'A';

    byRun.set(run.id, {
      runId:               run.id,
      violationsByAnalyte,
      allViolations,
      analitosComViolacao,
      conformidade,
    });
  }

  // ── Step 5: alertas de lote (validade) ────────────────────────────────────────
  const lotAlerts: Array<'lote_expirado' | 'validade_30d'> = [];
  const diffDias = daysToExpiry(validadeControle);

  if (diffDias < 0) {
    lotAlerts.push('lote_expirado');
  } else if (diffDias < DAYS_EXPIRY_WARNING) {
    lotAlerts.push('validade_30d');
  }

  // ── Step 6: derivar lotStatus ────────────────────────────────────────────────
  const hasAnyRejection = [...byRun.values()].some((r) => r.conformidade === 'R');
  const hasExpirado     = lotAlerts.includes('lote_expirado');
  const hasWarningOnly  = lotAlerts.includes('validade_30d');

  let lotStatus: CoagLotStatus;

  if (hasExpirado || hasAnyRejection) {
    lotStatus = 'reprovado';
  } else if (hasWarningOnly) {
    lotStatus = 'atencao';
  } else {
    lotStatus = 'valido';
  }

  return { byRun, lotStatus, lotAlerts };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCoagWestgard — avalia regras Westgard quantitativas para um lote de coagulação.
 *
 * Importa e reutiliza `checkWestgardRules` e `isRejection` de `westgardRules.ts` —
 * nunca reimplementa a lógica de z-score.
 *
 * Regras aplicadas por analito (CLSI C24-A3):
 *  1-2s  — Warning: 1 valor além de ±2SD.
 *  1-3s  — Rejeição: 1 valor além de ±3SD.
 *  2-2s  — Rejeição: 2 valores consecutivos além de ±2SD no mesmo lado.
 *  R-4s  — Rejeição: 2 valores consecutivos com amplitude >4SD (lados opostos).
 *  4-1s  — Rejeição: 4 valores consecutivos todos além de ±1SD no mesmo lado.
 *  10x   — Rejeição: 10 valores consecutivos todos do mesmo lado da média.
 *
 * lotStatus derivado:
 *  'sem_dados'  — Nenhum run no lote.
 *  'reprovado'  — Lote expirado OU pelo menos uma corrida com conformidade 'R'.
 *  'atencao'    — Validade próxima (< 30 dias) mas nenhuma rejeição.
 *  'valido'     — Nenhum alerta nem rejeição.
 *
 * @param runs             Corridas do lote (qualquer ordem — ordenadas internamente).
 * @param nivel            Nível do controle (I | II).
 * @param validadeControle Data de validade do controle no formato YYYY-MM-DD.
 */
export function useCoagWestgard(
  runs: CoagulacaoRun[],
  nivel: CoagNivel,
  validadeControle: string,
): CoagWestgardResult {
  return useMemo(
    () => computeCoagWestgard(runs, nivel, validadeControle),
    [runs, nivel, validadeControle],
  );
}
