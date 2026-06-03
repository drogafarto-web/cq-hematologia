/**
 * Portal RT — UI Primitives
 *
 * Dark-first typography and spacing components for RT operational dashboard.
 * References: Apple, Linear, Stripe — premium dark backgrounds, editorial typography.
 */

import React, { PropsWithChildren } from 'react';

// ─── Dark-first tokens ────────────────────────────────────────────────────────

export const PortalRTTokens = {
  bg: {
    base: 'bg-[#141417]', // Deep charcoal (dark-first)
    card: 'bg-[#1a1a1d]', // Card elevation
    hover: 'bg-[#242428]', // Hover state
    interactive: 'bg-[#2a2a2f]', // Input/buttons
  },
  text: {
    primary: 'text-white',
    secondary: 'text-white/70',
    tertiary: 'text-white/50',
    subtle: 'text-white/30',
  },
  border: {
    default: 'border-white/8',
    subtle: 'border-white/4',
  },
  accent: {
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
  },
} as const;

// ─── Heading ──────────────────────────────────────────────────────────────────

export interface PortalHeadingProps {
  level?: 1 | 2 | 3;
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export function PortalHeading({ level = 2, children, subtitle, className }: PortalHeadingProps) {
  const baseStyles = 'font-medium tracking-tight antialiased';
  const sizeStyles = {
    1: 'text-4xl',
    2: 'text-2xl',
    3: 'text-lg',
  };

  const Tag = `h${level}` as const;

  return (
    <div className={className}>
      <Tag className={`${sizeStyles[level]} ${baseStyles} ${PortalRTTokens.text.primary}`}>
        {children}
      </Tag>
      {subtitle && <p className={`mt-1 text-sm ${PortalRTTokens.text.secondary}`}>{subtitle}</p>}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export interface PortalSectionProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PortalSection({
  title,
  subtitle,
  actions,
  children,
  className,
}: PortalSectionProps) {
  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          {title && (
            <PortalHeading level={3} subtitle={subtitle}>
              {title}
            </PortalHeading>
          )}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface PortalCardProps extends PropsWithChildren {
  className?: string;
  interactive?: boolean;
}

export function PortalCard({ children, className, interactive }: PortalCardProps) {
  return (
    <div
      className={`
        rounded-2xl
        ${PortalRTTokens.bg.card}
        ${PortalRTTokens.border.default} border
        p-6
        transition-all duration-150
        ${interactive ? `cursor-pointer ${PortalRTTokens.bg.hover} hover:${PortalRTTokens.border.default}` : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ─── Text variants ────────────────────────────────────────────────────────────

export function PortalText({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <p className={`text-sm ${PortalRTTokens.text.primary} ${className}`}>{children}</p>;
}

export function PortalTextSecondary({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <p className={`text-sm ${PortalRTTokens.text.secondary} ${className}`}>{children}</p>;
}

// ─── Badge (status indicator) ─────────────────────────────────────────────────

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function PortalBadge({ variant, children, className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    danger: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    neutral: 'bg-white/10 text-white/70 border-white/20',
    info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  };

  return (
    <span
      className={`
      inline-block
      px-3 py-1
      rounded-full
      text-xs font-medium
      border
      ${variants[variant]}
      ${className}
    `}
    >
      {children}
    </span>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function PortalDivider({ className }: { className?: string }) {
  return <div className={`h-px ${PortalRTTokens.border.default} bg-white/8 ${className}`} />;
}

// ─── Spacing utilities ────────────────────────────────────────────────────────

export const PortalSpacing = {
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;
