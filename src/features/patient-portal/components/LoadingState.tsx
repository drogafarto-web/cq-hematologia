/**
 * LoadingState — Skeleton screen + loading indicators
 * WCAG 2.1 AAA — Accessible loading states with aria-busy
 *
 * Props:
 *   - variant: 'skeleton' | 'spinner' | 'minimal'
 *   - count?: number of skeleton items (default 3)
 *   - label?: aria-label for loading state (default "Loading...")
 *   - fullHeight?: fill parent height (useful for centered screens)
 *   - ariaLive?: 'polite' | 'assertive' (default 'polite')
 */

import React from 'react';

export interface LoadingStateProps {
  variant?: 'skeleton' | 'spinner' | 'minimal';
  count?: number;
  label?: string;
  fullHeight?: boolean;
  ariaLive?: 'polite' | 'assertive';
}

export const LoadingState = React.memo(function LoadingState({
  variant = 'skeleton',
  count = 3,
  label = 'Carregando...',
  fullHeight = false,
  ariaLive = 'polite',
}: LoadingStateProps) {
  const containerClass = fullHeight ? 'min-h-screen' : '';

  if (variant === 'spinner') {
    return (
      <div
        className={`
          flex items-center justify-center gap-3
          ${containerClass} p-8
        `}
        role="status"
        aria-busy="true"
        aria-live={ariaLive}
        aria-label={label}
      >
        {/* Animated spinner */}
        <div
          className={`
            w-5 h-5 border-2 border-slate-600 border-t-blue-400
            rounded-full animate-spin
          `}
          aria-hidden="true"
        />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live={ariaLive}
        aria-label={label}
        className={containerClass}
      >
        <p className="text-sm text-slate-400 text-center py-8">
          {label}
        </p>
      </div>
    );
  }

  // Skeleton variant (preferred for lists)
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live={ariaLive}
      aria-label={label}
      className={`space-y-3 ${containerClass} p-4`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`
            rounded-lg bg-white/4 border border-white/8
            h-16 animate-pulse
          `}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

LoadingState.displayName = 'LoadingState';
