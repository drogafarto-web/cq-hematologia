/**
 * Aggregate filter utilities
 *
 * The AnalyticsAggregate is a flat, pre-computed summary produced by the hourly
 * Cloud Function. It does NOT store per-equipment or per-operator breakdowns —
 * it aggregates across all equipment and operators for the lab.
 *
 * Consequence: equipment and operator filters CANNOT be applied to aggregate-derived
 * KPIs (compliance %, open NCs, turnaround, retrabalho, NC heatmap, training summary).
 * The correct UX is to inform the user rather than silently no-op.
 *
 * Filtering IS structurally possible for CIQTrendsDash observations (CIQRunObservation
 * carries equipmentId), but those observations are simulated in Phase 3.1 and will be
 * properly filterable when Phase 3.2 wires real sub-collection data.
 *
 * filterCapabilities() — query whether a given dashboard can honour the active filters.
 * isAggregateFilterable() — shorthand boolean for aggregate-based dashboards.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardFilterability =
  | 'full' // Dashboard can filter by all selected dimensions
  | 'partial' // Dashboard can filter by some (e.g. equipment but not operator)
  | 'none'; // Dashboard is based on pre-aggregated data; filter cannot be applied

export interface FilterCapability {
  filterability: DashboardFilterability;
  /** Human-readable explanation surfaced in the unavailable banner */
  reason: string;
}

export type AggregateDashboardId = 'compliance' | 'nc-heatmap' | 'training' | 'trends';

// ─── Per-dashboard capability map ────────────────────────────────────────────

const DASHBOARD_FILTER_CAPABILITIES: Record<AggregateDashboardId, FilterCapability> = {
  compliance: {
    filterability: 'none',
    reason:
      'Os KPIs de conformidade são calculados sobre dados pré-agregados por equipamento ' +
      'e operador. Para filtrar por equipamento ou operador, utilize os relatórios ' +
      'individuais de corridas CIQ.',
  },
  'nc-heatmap': {
    filterability: 'none',
    reason:
      'O heatmap de NCs é gerado a partir de dados pré-agregados. ' +
      'Filtragem por equipamento ou operador requer acesso às NCs individuais.',
  },
  training: {
    filterability: 'partial',
    reason:
      'A matriz de treinamentos pode ser filtrada por operador. ' +
      'Filtragem por equipamento não se aplica a registros de treinamento.',
  },
  trends: {
    filterability: 'partial',
    reason:
      'O gráfico de tendências pode ser filtrado por equipamento quando dados ' +
      'por corrida estiverem disponíveis (Fase 3.2+). ' +
      'Filtragem por operador não se aplica a corridas CIQ.',
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the filter capability descriptor for a given dashboard.
 */
export function filterCapabilities(dashboardId: AggregateDashboardId): FilterCapability {
  return DASHBOARD_FILTER_CAPABILITIES[dashboardId];
}

/**
 * Returns true when any filter is active but the dashboard cannot honour it.
 *
 * Use this to decide whether to render FilterUnavailableBanner.
 *
 * @param dashboardId Dashboard being rendered
 * @param equipmentIds Selected equipment IDs (empty Set = no filter)
 * @param operatorIds Selected operator IDs (empty Set = no filter)
 */
export function shouldShowFilterUnavailableBanner(
  dashboardId: AggregateDashboardId,
  equipmentIds: Set<string>,
  operatorIds: Set<string>,
): boolean {
  const hasActiveFilter = equipmentIds.size > 0 || operatorIds.size > 0;
  if (!hasActiveFilter) return false;

  const cap = DASHBOARD_FILTER_CAPABILITIES[dashboardId];
  return cap.filterability === 'none';
}

/**
 * Returns true when some filters are active but the dashboard only partially
 * supports them — used to show a partial-support notice (softer than banner).
 */
export function shouldShowPartialFilterNotice(
  dashboardId: AggregateDashboardId,
  equipmentIds: Set<string>,
  operatorIds: Set<string>,
): boolean {
  const hasActiveFilter = equipmentIds.size > 0 || operatorIds.size > 0;
  if (!hasActiveFilter) return false;

  const cap = DASHBOARD_FILTER_CAPABILITIES[dashboardId];
  return cap.filterability === 'partial';
}
