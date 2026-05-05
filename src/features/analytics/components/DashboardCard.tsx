/**
 * DashboardCard — Reusable KPI card component
 *
 * Dark-first design. Shows a primary metric with optional trend delta,
 * subtitle, and status color band. Supports skeleton loading state.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'success' | 'warning' | 'critical' | 'neutral';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number | null;
  deltaLabel?: string;
  variant?: CardVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

// ─── Variant tokens ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<CardVariant, { accent: string; glow: string }> = {
  default:  { accent: 'border-white/10',      glow: '' },
  success:  { accent: 'border-emerald-500/30', glow: 'shadow-emerald-500/5' },
  warning:  { accent: 'border-amber-500/30',   glow: 'shadow-amber-500/5' },
  critical: { accent: 'border-red-500/30',     glow: 'shadow-red-500/5' },
  neutral:  { accent: 'border-violet-500/30',  glow: 'shadow-violet-500/5' },
};

const DELTA_COLOR = (d: number) =>
  d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-white/40';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-5 animate-pulse">
      <div className="h-3 w-24 rounded bg-white/10 mb-4" />
      <div className="h-8 w-32 rounded bg-white/8 mb-2" />
      <div className="h-2.5 w-20 rounded bg-white/6" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardCard = React.memo(function DashboardCard({
  title,
  value,
  subtitle,
  delta,
  deltaLabel,
  variant = 'default',
  icon,
  loading = false,
  className = '',
}: DashboardCardProps) {
  if (loading) return <CardSkeleton />;

  const { accent, glow } = VARIANT_STYLES[variant];
  const hasDelta = delta !== null && delta !== undefined;

  return (
    <article
      className={[
        'rounded-xl border bg-white/[0.035] p-5 transition-all duration-200',
        'hover:bg-white/[0.05] hover:border-white/15',
        'shadow-lg',
        accent,
        glow,
        className,
      ].join(' ')}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium tracking-wider text-white/50 uppercase">
          {title}
        </p>
        {icon && (
          <span className="text-white/30" aria-hidden>
            {icon}
          </span>
        )}
      </header>

      {/* Primary value */}
      <p className="text-3xl font-semibold tabular-nums text-white leading-none mb-1.5">
        {value}
      </p>

      {/* Subtitle + delta */}
      <footer className="flex items-center gap-2 mt-2">
        {subtitle && (
          <span className="text-xs text-white/40">{subtitle}</span>
        )}
        {hasDelta && (
          <span
            className={['text-xs font-medium tabular-nums', DELTA_COLOR(delta!)].join(' ')}
            aria-label={`Variação: ${delta! > 0 ? '+' : ''}${delta}`}
          >
            {delta! > 0 ? '+' : ''}
            {delta}
            {deltaLabel ?? ''}
          </span>
        )}
      </footer>
    </article>
  );
});
