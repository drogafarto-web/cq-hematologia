import type { AnalyteStats, CQRun } from '../types';

/**
 * Calcula Z-Score: (valor - média) / desvio-padrão.
 *
 * Retorna NaN se sd === 0 (lote novo com < 2 corridas).
 * Checar isNaN(z) antes de usar o resultado.
 */
export function calculateZScore(value: number, stats: AnalyteStats): number {
  if (stats.sd === 0) return NaN;
  return (value - stats.mean) / stats.sd;
}

export function interpretZScore(z: number): 'acceptable' | 'warning' | 'rejection' {
  // sd === 0 → tratar como warning (lote novo sem estatísticas)
  if (isNaN(z)) return 'warning';
  return Math.abs(z) <= 2 ? 'acceptable'
       : Math.abs(z) <= 3 ? 'warning'
       : 'rejection';
}

/**
 * Calcula estatísticas amostrais de um analito a partir de corridas confirmadas.
 *
 * Usa desvio padrão AMOSTRAL (÷ n-1) conforme ISO 5725 / CLSI EP05.
 */
export function calculateRunStats(
  runs: CQRun[],
  analyte: string
): Required<AnalyteStats> {
  const values = runs
    .map(run => run.confirmedData[analyte])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) {
    return { mean: 0, sd: 0, cv: 0, n: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Desvio padrão AMOSTRAL (ISO 5725 / CLSI EP05) — divisor n-1
  const sd = values.length < 2
    ? 0
    : Math.sqrt(
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1)
      );

  // Guard: mean === 0 evita CV = Infinity
  const cv = mean !== 0 ? (sd / mean) * 100 : 0;

  return { mean, sd, cv, n: values.length };
}
