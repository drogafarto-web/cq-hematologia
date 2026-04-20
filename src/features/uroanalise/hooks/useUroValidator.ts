/**
 * useUroValidator.ts — Validação ordinal categórica para o módulo de uroanálise.
 *
 * Exporta:
 *  - `validateUroResultado`  — valida um único valor de analito contra o critério do nível.
 *  - `avaliarRunUro`         — avalia uma corrida inteira contra o critério do nível.
 *  - `computeUroValidator`   — função pura (usável fora de componentes React, ex: no save flow).
 *  - `useUroValidator`       — hook React memoizado sobre a função pura.
 *
 * Padrão espelhado de `useCIQWestgard.ts` (módulo ciq-imuno) com função pura exportada.
 *
 * Avaliação ordinal conforme CLSI GP16-A3:
 *  - Categórico: conforme se o valor está na lista de valores aceitos do URO_CRITERIOS.
 *  - Numérico (pH/densidade): conforme se o valor ∈ [min, max] do URO_CRITERIOS.
 *
 * Nota: a tolerância ±1 nível ordinal convencional (CLSI GP16-A3) é implementada
 * no nível do critério — os arrays de valores aceitos em URO_CRITERIOS já incluem
 * o range tolerado para o nível P. Para o nível N (todos negativos), qualquer
 * positividade é não-conformidade.
 *
 * Compliance: RDC 302/2005 · RDC 978/2025 · CLSI GP16-A3 · EUG
 */

import { useMemo } from 'react';
import { URO_ANALITOS, URO_CRITERIOS } from '../UroAnalyteConfig';
import type { UroanaliseRun } from '../types/Uroanalise';
import type {
  UroAnalitoId,
  UroNivel,
  UroValorCategorico,
  UroAlert,
  UroLotStatus,
} from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Resultado de avaliação de conformidade de uma única corrida de uroanálise.
 */
export interface UroRunAvaliacao {
  /** ID da corrida avaliada. */
  runId: string;
  /**
   * Conformidade por analito.
   *  `true`  = conforme com o critério do nível.
   *  `false` = fora do critério (não conformidade).
   * Analitos não preenchidos (valor null) NÃO aparecem neste mapa.
   */
  conformidadePorAnalito: Partial<Record<UroAnalitoId, boolean>>;
  /** Analitos avaliados que ficaram fora do critério do nível. */
  analitosNaoConformes: UroAnalitoId[];
  /**
   * Conformidade global da corrida:
   *  'A' — Aceitável: nenhum analito fora do critério.
   *  'R' — Rejeitado: pelo menos um analito fora do critério (requer ação corretiva).
   */
  conformidade: 'A' | 'R';
}

/**
 * Resultado agregado de validação ordinal de um lote de uroanálise.
 */
export interface UroValidatorResult {
  /** Mapa runId → avaliação de conformidade (toda corrida avaliada está neste mapa). */
  byRun: Map<string, UroRunAvaliacao>;
  /** Status calculado do lote com base no conjunto completo de runs e alertas. */
  lotStatus: UroLotStatus;
  /** Alertas de qualidade do lote. */
  alerts: UroAlert[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Mínimo de runs no lote para ativar a regra de taxa de NC (>10%). */
const MIN_RUNS_FOR_RATE_RULE = 10;

/** Percentual máximo de NCs aceitável no lote (10%). */
const MAX_NC_RATE = 0.10;

/** Janela de runs recentes para a regra de 4+ NCs. */
const WINDOW_RECENT_RUNS = 10;

/** NCs consecutivos que ativa alerta `consecutivos_3nc`. */
const THRESHOLD_CONSECUTIVE_NC = 3;

/** NCs em janela recente que ativa alerta `consecutivos_4nc`. */
const THRESHOLD_WINDOW_NC = 4;

/** Dias antes da validade que ativa alerta `validade_30d`. */
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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Valida um único valor de analito contra o critério do nível.
 *
 * Lida com dois tipos de critério:
 *  - Categórico (array readonly): conforme se `valor ∈ array`.
 *  - Numérico `{min, max}`: conforme se `valor ∈ [min, max]` (inclusivo em ambas as pontas).
 *
 * @param analito Identificador canônico do analito.
 * @param valor   Valor obtido — `UroValorCategorico` para categóricos, `number` para pH/densidade,
 *                ou `null` quando não preenchido.
 * @param nivel   Nível do controle (N | P) — determina qual critério consultar.
 * @returns
 *  - `true`  se o valor está conforme com o critério.
 *  - `false` se o valor está fora do critério.
 *  - `null`  quando não há critério definido para o analito no nível informado,
 *            ou quando o valor é `null` (analito não preenchido).
 */
export function validateUroResultado(
  analito: UroAnalitoId,
  valor: UroValorCategorico | number | null,
  nivel: UroNivel,
): boolean | null {
  if (valor === null) return null;

  const criterioNivel = URO_CRITERIOS[nivel];
  const criterio      = criterioNivel[analito];

  if (!criterio) return null;

  // Critério numérico ({min, max}) — pH e densidade
  if ('min' in criterio && 'max' in criterio) {
    if (typeof valor !== 'number') return null; // tipo incompatível — não gera falso positivo
    return valor >= criterio.min && valor <= criterio.max;
  }

  // Critério categórico (array readonly) — todos os demais analitos
  return (criterio as readonly UroValorCategorico[]).includes(valor as UroValorCategorico);
}

/**
 * Avalia uma corrida inteira de uroanálise contra o critério do seu nível.
 *
 * Itera sobre `URO_ANALITOS` (ordem canônica) e avalia cada analito presente
 * em `run.resultados` cujo valor não seja null.
 *
 * O campo `nivel` é lido diretamente da corrida (`run.nivel`) — não precisa
 * ser passado externamente.
 *
 * @param run Corrida de uroanálise a ser avaliada.
 * @returns   `UroRunAvaliacao` com conformidade por analito e status global.
 */
export function avaliarRunUro(run: UroanaliseRun): UroRunAvaliacao {
  const nivel = run.nivel;
  const conformidadePorAnalito: Partial<Record<UroAnalitoId, boolean>> = {};
  const analitosNaoConformes: UroAnalitoId[] = [];

  for (const analito of URO_ANALITOS) {
    const campo = run.resultados[analito as keyof typeof run.resultados];
    if (!campo) continue;

    const valor = campo.valor as UroValorCategorico | number | null;
    const resultado = validateUroResultado(analito, valor, nivel);

    if (resultado === null) continue; // Analito sem critério ou sem valor — não avalia

    conformidadePorAnalito[analito] = resultado;
    if (!resultado) {
      analitosNaoConformes.push(analito);
    }
  }

  const conformidade: 'A' | 'R' = analitosNaoConformes.length > 0 ? 'R' : 'A';

  return {
    runId:                  run.id,
    conformidadePorAnalito,
    analitosNaoConformes,
    conformidade,
  };
}

/**
 * Calcula status agregado do lote de uroanálise + alertas.
 *
 * Análogo a `computeWestgardCategorico` do módulo ciq-imuno, adaptado para
 * avaliação ordinal de uroanálise.
 *
 * Alertas gerados:
 *  `taxa_nc_10pct`    — Taxa de NC >10% no total do lote (mínimo 10 runs).
 *  `consecutivos_3nc` — 3 runs NC consecutivos (ordem cronológica desc).
 *  `consecutivos_4nc` — 4+ NCs nos últimos 10 runs.
 *  `lote_expirado`    — `validadeControle` anterior a hoje → lotStatus: reprovado.
 *  `validade_30d`     — `validadeControle` expira em menos de 30 dias → lotStatus: atencao.
 *
 * @param runs             Corridas do lote (qualquer ordem — ordena internamente por data desc).
 * @param validadeControle Data de validade do controle no formato YYYY-MM-DD.
 * @returns                `UroValidatorResult` com mapa por corrida, alertas e status do lote.
 */
export function computeUroValidator(
  runs: UroanaliseRun[],
  validadeControle: string,
): UroValidatorResult {
  if (runs.length === 0) {
    return { byRun: new Map(), lotStatus: 'sem_dados', alerts: [] };
  }

  // ── Avaliar cada corrida ─────────────────────────────────────────────────────
  const byRun = new Map<string, UroRunAvaliacao>();
  for (const run of runs) {
    byRun.set(run.id, avaliarRunUro(run));
  }

  const alerts: UroAlert[] = [];
  const total = runs.length;

  // ── Ordenar cronologicamente desc (mais recente primeiro) para regras de sequência ─
  const recentes = [...runs].sort(
    (a, b) => new Date(b.dataRealizacao).getTime() - new Date(a.dataRealizacao).getTime(),
  );

  // ── Regra: taxa_nc_10pct ─────────────────────────────────────────────────────
  const countNC = [...byRun.values()].filter((r) => r.conformidade === 'R').length;
  if (total >= MIN_RUNS_FOR_RATE_RULE && countNC / total > MAX_NC_RATE) {
    alerts.push('taxa_nc_10pct');
  }

  // ── Regra: consecutivos_3nc ──────────────────────────────────────────────────
  let consecutivosNC = 0;
  for (const run of recentes) {
    const avaliacao = byRun.get(run.id);
    if (avaliacao?.conformidade === 'R') {
      consecutivosNC++;
      if (consecutivosNC >= THRESHOLD_CONSECUTIVE_NC) {
        alerts.push('consecutivos_3nc');
        break;
      }
    } else {
      consecutivosNC = 0;
    }
  }

  // ── Regra: consecutivos_4nc (4+ NCs nos últimos 10 runs) ─────────────────────
  const ultimos10  = recentes.slice(0, WINDOW_RECENT_RUNS);
  const ncNaJanela = ultimos10.filter((r) => byRun.get(r.id)?.conformidade === 'R').length;
  if (ncNaJanela >= THRESHOLD_WINDOW_NC) {
    alerts.push('consecutivos_4nc');
  }

  // ── Regras de validade ────────────────────────────────────────────────────────
  const diffDias = daysToExpiry(validadeControle);
  if (diffDias < 0) {
    alerts.push('lote_expirado');
  } else if (diffDias < DAYS_EXPIRY_WARNING) {
    alerts.push('validade_30d');
  }

  // ── Derivar lotStatus ────────────────────────────────────────────────────────
  const isReprovado = alerts.includes('taxa_nc_10pct') || alerts.includes('lote_expirado');

  const lotStatus: UroLotStatus =
    alerts.length === 0 ? 'valido'    :
    isReprovado         ? 'reprovado' :
                          'atencao';

  return { byRun, lotStatus, alerts };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useUroValidator — avalia conformidade ordinal categórica para um lote de uroanálise.
 *
 * Regras aplicadas (análogas ao ciq-imuno, adaptadas para avaliação ordinal):
 *  1. taxa_nc_10pct    — >10% NCs no total do lote (mín. 10 runs).
 *  2. consecutivos_3nc — 3+ NCs consecutivos (ordem cronológica desc).
 *  3. consecutivos_4nc — 4+ NCs nos últimos 10 runs.
 *  4. lote_expirado    — validadeControle < hoje → lotStatus: reprovado.
 *  5. validade_30d     — validadeControle expira em <30 dias → lotStatus: atencao.
 *
 * lotStatus:
 *  - 'sem_dados'  — Nenhum run no lote.
 *  - 'valido'     — Nenhum alerta ativo.
 *  - 'atencao'    — Alertas presentes, mas sem reprovação formal.
 *  - 'reprovado'  — taxa_nc_10pct ou lote_expirado ativo.
 *
 * @param runs             Corridas do lote (qualquer ordem).
 * @param validadeControle Data de validade do controle no formato YYYY-MM-DD.
 */
export function useUroValidator(
  runs: UroanaliseRun[],
  validadeControle: string,
): UroValidatorResult {
  return useMemo(
    () => computeUroValidator(runs, validadeControle),
    [runs, validadeControle],
  );
}
