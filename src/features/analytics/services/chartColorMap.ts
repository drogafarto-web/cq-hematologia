/**
 * Chart color mapping for analytics dashboards
 *
 * All colors sourced from the HC Quality design system.
 * Dark-first: optimized for bg-[#141417] background.
 *
 * Token reference:
 *   - emerald-500  (#10b981) — valid / good / in-control
 *   - amber-500   (#f59e0b) — warning / expiring / 2SD breach
 *   - red-500     (#ef4444) — critical / expired / 3SD breach
 *   - violet-500  (#8b5cf6) — neutral KPIs / trend lines
 *   - white/10    (#ffffff1a) — grid lines, muted elements
 *   - white/20    (#ffffff33) — reference lines
 *   - white/40    (#ffffff66) — secondary labels
 */

// ─── Semantic color tokens ────────────────────────────────────────────────────

export const CHART_COLORS = {
  /** Valid runs, compliance above threshold, certified training */
  valid: '#10b981',       // emerald-500
  /** Warning state — approaching limit, expiring soon */
  warning: '#f59e0b',     // amber-500
  /** Critical — out of control, expired, past 3SD */
  critical: '#ef4444',    // red-500
  /** Neutral KPI — trend lines, processed hours, misc */
  neutral: '#8b5cf6',     // violet-500
  /** Secondary metric — invalid runs, rework */
  secondary: '#f97316',   // orange-500
  /** Muted — grid, reference areas */
  muted: '#ffffff1a',
  /** Subtle — secondary reference lines */
  subtle: '#ffffff33',
  /** Label text — axis ticks, tooltips */
  label: '#ffffff66',
} as const;

// ─── Levey-Jennings specific ──────────────────────────────────────────────────

export const LJ_COLORS = {
  /** Data point — valid run */
  pointValid: CHART_COLORS.valid,
  /** Data point — invalid/rejected run */
  pointInvalid: CHART_COLORS.critical,
  /** Connecting line between observations */
  line: '#8b5cf6',         // violet-500
  /** Mean line */
  mean: '#ffffff80',
  /** ±2SD warning band fill */
  warningBand: '#f59e0b18',
  /** ±2SD boundary lines */
  warningLine: '#f59e0b60',
  /** ±3SD control boundary lines */
  controlLine: '#ef444460',
} as const;

// ─── Heatmap color ramp ───────────────────────────────────────────────────────

/**
 * Compute heatmap cell background color from intensity [0, 1].
 * Uses an emerald → amber → red ramp for visual clarity on dark backgrounds.
 *
 * @param intensity Normalized value 0 (none) to 1 (max)
 * @returns CSS rgba color string
 */
export function heatmapCellColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(255,255,255,0.04)';
  if (intensity < 0.33) {
    const t = intensity / 0.33;
    const g = Math.round(185 + (159 - 185) * t); // emerald → amber
    return `rgba(16, ${g}, ${Math.round(129 * (1 - t))}, ${0.15 + t * 0.25})`;
  }
  if (intensity < 0.66) {
    const t = (intensity - 0.33) / 0.33;
    return `rgba(245, 158, ${Math.round(11 * (1 - t))}, ${0.3 + t * 0.25})`;
  }
  const t = (intensity - 0.66) / 0.34;
  return `rgba(239, 68, 68, ${0.4 + t * 0.4})`;
}

// ─── Module color assignments ─────────────────────────────────────────────────

/** Deterministic per-module accent colors for NC heatmap rows */
export const MODULE_COLORS: Record<string, string> = {
  'ciq-imuno': '#8b5cf6',
  coagulacao: '#3b82f6',
  uroanalise: '#06b6d4',
  insumos: '#f59e0b',
  pops: '#10b981',
  treinamentos: '#f97316',
  biosseguranca: '#ec4899',
  pgrss: '#84cc16',
  sgq: '#a78bfa',
  analyzer: '#60a5fa',
  // Fallback
  _default: '#ffffff40',
};

export function moduleColor(slug: string): string {
  return MODULE_COLORS[slug] ?? MODULE_COLORS['_default'];
}

// ─── Training status colors ───────────────────────────────────────────────────

export const TRAINING_STATUS_COLORS = {
  valid: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  expiring: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  expired: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  not_trained: { bg: 'bg-white/5', text: 'text-white/40', border: 'border-white/10' },
} as const;
