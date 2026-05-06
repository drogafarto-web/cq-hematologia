/**
 * Hook: Transform raw analytics aggregates to Recharts-compatible data
 *
 * All transformations are memoized — recomputes only when aggregate changes.
 * No Firestore reads here: input comes from the Zustand store.
 */

import { useMemo } from 'react';
import { useAnalyticsStore } from './useAnalyticsCache';
import { normalizeHeatmapIntensities } from '../services/kpiCalculators';
import { heatmapCellColor, moduleColor } from '../services/chartColorMap';
import type { AnalyticsAggregate, NCHeatmapCell, ChartDataPoint } from '../types/Analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompliancePieData {
  name: string;
  value: number;
  fill: string;
}

export interface NCDistributionData {
  name: string;
  value: number;
  fill: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Derive chart-ready data structures from the analytics aggregate.
 *
 * @returns Memoized chart data for all dashboard visualizations
 */
export function useChartData() {
  const aggregate = useAnalyticsStore((s) => s.aggregate);

  // ── Compliance pie (valid vs invalid runs) ─────────────────────────────────
  const compliancePie = useMemo((): CompliancePieData[] => {
    if (!aggregate) return [];
    return [
      { name: 'Conformes', value: aggregate.validRuns, fill: '#10b981' },
      { name: 'Não conformes', value: aggregate.invalidRuns, fill: '#ef4444' },
    ];
  }, [aggregate]);

  // ── NC age distribution (for bar chart in NC heatmap header) ───────────────
  const ncAgeDist = useMemo((): NCDistributionData[] => {
    if (!aggregate) return [];
    const { ncAgeBuckets } = aggregate;
    return [
      { name: '≤ 7 dias', value: ncAgeBuckets['7d'], fill: '#10b981' },
      { name: '8–30 dias', value: ncAgeBuckets['30d'], fill: '#f59e0b' },
      { name: '31–60 dias', value: ncAgeBuckets['60d'], fill: '#f97316' },
      { name: '> 60 dias', value: ncAgeBuckets['>60d'], fill: '#ef4444' },
    ];
  }, [aggregate]);

  // ── NC heatmap cells ───────────────────────────────────────────────────────
  const heatmapCells = useMemo((): NCHeatmapCell[] => {
    if (!aggregate) return [];

    const AGE_BUCKETS: Array<NCHeatmapCell['ageBucket']> = ['7d', '30d', '60d', '>60d'];
    const modules = Object.keys(aggregate.ncByModule);
    if (modules.length === 0) return [];

    // Build flat cell list
    const cells: Omit<NCHeatmapCell, 'intensity'>[] = [];
    for (const slug of modules) {
      for (const bucket of AGE_BUCKETS) {
        // Distribute module NC count proportionally across age buckets
        // (In a real system, per-module age data would come from aggregate)
        const bucketRatio = aggregate.ncAgeBuckets[bucket] /
          Math.max(1, aggregate.openNCs);
        cells.push({
          moduleSlug: slug,
          moduleLabel: formatModuleLabel(slug),
          ageBucket: bucket,
          count: Math.round(aggregate.ncByModule[slug] * bucketRatio),
        });
      }
    }

    const intensities = normalizeHeatmapIntensities(cells);
    return cells.map((cell, i) => ({ ...cell, intensity: intensities[i] }));
  }, [aggregate]);

  // ── Simulated LJ trend data (placeholder until real CIQ time series) ───────
  const ljChartData = useMemo((): ChartDataPoint[] => {
    // Generate synthetic observations — always shown; compliance drives outlier rate.
    // When no aggregate exists (no Firestore data yet), default to 88% compliance for demo.
    const POINTS = 20;
    const mean = 10;
    const sd = 0.5;
    const now = Date.now();
    const compliance = aggregate ? aggregate.compliancePercent / 100 : 0.88;

    return Array.from({ length: POINTS }, (_, i) => {
      const timestamp = now - (POINTS - i) * 3_600_000; // hourly
      const jitter = (Math.random() - 0.5) * sd * 4;
      const isOutlier = Math.random() > compliance;
      const value = isOutlier
        ? mean + (Math.random() > 0.5 ? 1 : -1) * sd * (2.5 + Math.random())
        : mean + jitter * 0.6;

      return {
        label: new Date(timestamp).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        timestamp,
        value: Math.round(value * 100) / 100,
        mean,
        upperWarning: mean + 2 * sd,
        lowerWarning: mean - 2 * sd,
        upperControl: mean + 3 * sd,
        lowerControl: mean - 3 * sd,
        isValid: Math.abs(value - mean) <= 2 * sd,
      };
    });
  }, [aggregate]);

  return { compliancePie, ncAgeDist, heatmapCells, ljChartData };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatModuleLabel(slug: string): string {
  const labels: Record<string, string> = {
    'ciq-imuno': 'Imunologia',
    coagulacao: 'Coagulação',
    uroanalise: 'Uroanálise',
    insumos: 'Insumos',
    pops: 'POPs',
    treinamentos: 'Treinamentos',
    biosseguranca: 'Biossegurança',
    pgrss: 'PGRSS',
    sgq: 'SGQ',
    analyzer: 'Hematologia',
  };
  return labels[slug] ?? slug;
}
