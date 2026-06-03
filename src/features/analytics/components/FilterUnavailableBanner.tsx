/**
 * FilterUnavailableBanner — Informs user that active filters cannot be applied
 *
 * Rendered by aggregate-based dashboards (compliance, NC heatmap) when equipment
 * or operator filters are selected. The aggregate is pre-computed across all
 * entities and does not carry per-equipment or per-operator breakdowns.
 *
 * Design: amber warning tone, inline SVG icon, dismissible via context.
 * A11y: role="status", aria-live="polite" — non-disruptive announcement.
 */

import React from 'react';

// ─── Inline SVG icon ──────────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="shrink-0 mt-px"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterUnavailableBannerProps {
  reason: string;
  /** Optional label for the filter dimension(s) active (e.g. "Equipamento, Operador") */
  activeFilterLabel?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FilterUnavailableBanner = React.memo(function FilterUnavailableBanner({
  reason,
  activeFilterLabel,
  className = '',
}: FilterUnavailableBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-start gap-2.5 rounded-lg border border-amber-500/20',
        'bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-400/90',
        className,
      ].join(' ')}
    >
      <InfoIcon />
      <div className="space-y-0.5 leading-relaxed">
        {activeFilterLabel && (
          <p className="font-medium text-amber-400">Filtro ativo: {activeFilterLabel}</p>
        )}
        <p className="text-amber-400/70">{reason}</p>
      </div>
    </div>
  );
});
