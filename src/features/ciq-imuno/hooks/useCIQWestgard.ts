import { useMemo } from 'react';
import type { CIQImunoRun } from '../types/CIQImuno';
import type { WestgardCatAlert, CIQLotStatus } from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CIQWestgardResult {
  alerts: WestgardCatAlert[];
  lotStatus: CIQLotStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mínimo de runs no lote para ativar a regra de taxa de falha (>10%). */
const MIN_RUNS_FOR_RATE_RULE = 10;

/** Percentual máximo de NR aceitável no lote. */
const MAX_FAILURE_RATE = 0.10;

/** Janela de runs recentes para a regra de 4+ NR. */
const WINDOW_RECENT_RUNS = 10;

/** NR consecutivos que ativa alerta. */
const THRESHOLD_CONSECUTIVE_NR = 3;

/** NR em janela recente que ativa alerta. */
const THRESHOLD_WINDOW_NR = 4;

/** Dias antes da validade que ativa alerta de proximidade. */
const DAYS_EXPIRY_WARNING = 30;

// ─── Pure computation (exportada para uso imperativo no save flow) ────────────

/**
 * Versão pura (sem hook) do cálculo Westgard categórico.
 * Pode ser chamada fora de componentes React — ex: em useSaveCIQRun.
 */
export function computeWestgardCategorico(runs: CIQImunoRun[]): CIQWestgardResult {
  if (runs.length === 0) {
    return { alerts: [], lotStatus: 'sem_dados' };
  }

  const alerts: WestgardCatAlert[] = [];
  const total = runs.length;

  const recentes = [...runs].sort(
    (a, b) => new Date(b.dataRealizacao).getTime() - new Date(a.dataRealizacao).getTime()
  );

  const countNR = runs.filter((r) => r.resultadoObtido === 'NR').length;
  if (total >= MIN_RUNS_FOR_RATE_RULE && countNR / total > MAX_FAILURE_RATE) {
    alerts.push('taxa_falha_10pct');
  }

  let consecutivosNR = 0;
  for (const run of recentes) {
    if (run.resultadoObtido === 'NR') {
      consecutivosNR++;
      if (consecutivosNR >= THRESHOLD_CONSECUTIVE_NR) {
        alerts.push('consecutivos_3nr');
        break;
      }
    } else {
      consecutivosNR = 0;
    }
  }

  const ultimos10  = recentes.slice(0, WINDOW_RECENT_RUNS);
  const nrNaJanela = ultimos10.filter((r) => r.resultadoObtido === 'NR').length;
  if (nrNaJanela >= THRESHOLD_WINDOW_NR) {
    alerts.push('consecutivos_4nr');
  }

  const maisRecente = recentes[0];
  if (maisRecente) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    // Parse local para evitar drift de fuso (new Date('YYYY-MM-DD') interpreta como UTC)
    const [y, m, d] = maisRecente.validadeControle.split('-').map(Number);
    const validade = new Date(y, m - 1, d, 0, 0, 0, 0);
    const diffDias = (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDias < 0) {
      alerts.push('lote_expirado');
    } else if (diffDias < DAYS_EXPIRY_WARNING) {
      alerts.push('validade_30d');
    }
  }

  const isReprovado = alerts.some(
    (a) => a === 'taxa_falha_10pct' || a === 'lote_expirado'
  );

  const lotStatus: CIQLotStatus =
    alerts.length === 0 ? 'valido' :
    isReprovado         ? 'reprovado' :
                          'atencao';

  return { alerts, lotStatus };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useCIQWestgard — avalia regras de qualidade categóricas (R/NR) para um lote de CIQ-Imuno.
 *
 * INDEPENDENTE do westgardRules.ts (quantitativo/z-score para hematologia).
 * Processa exclusivamente dados R/NR conforme RDC 978/2025 Art.128.
 *
 * Regras aplicadas:
 *  1. taxa_falha_10pct  — >10% NR no total do lote (mín. 10 runs)
 *  2. consecutivos_3nr  — 3+ NR consecutivos (ordem cronológica desc)
 *  3. consecutivos_4nr  — 4+ NR nos últimos 10 runs
 *  4. lote_expirado     — validadeControle < hoje → lotStatus: reprovado
 *  5. validade_30d      — validadeControle expira em <30 dias → lotStatus: atencao
 *
 * lotStatus:
 *  - 'sem_dados'  — nenhum run no lote
 *  - 'valido'     — nenhum alerta ativo
 *  - 'atencao'    — alertas presentes, mas sem reprovação formal
 *  - 'reprovado'  — taxa_falha_10pct ou lote_expirado ativo
 */
export function useCIQWestgard(runs: CIQImunoRun[]): CIQWestgardResult {
  return useMemo(() => computeWestgardCategorico(runs), [runs]);
}
