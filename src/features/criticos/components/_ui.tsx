/**
 * _ui — shared design primitives for the Críticos shell.
 *
 * Dark-first tokens. No icon library — SVGs use currentColor.
 * 4px grid spacing only.
 */

import React from 'react';

const REDUCE_MOTION_CLASS =
  'motion-reduce:transition-none motion-reduce:transform-none';

// ─── Buttons ────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className = '', children, type, ...rest },
    ref,
  ) {
    const base =
      'inline-flex items-center gap-2 rounded-md font-medium ' +
      'transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] ' +
      'disabled:opacity-40 disabled:cursor-not-allowed ' +
      REDUCE_MOTION_CLASS;
    const sizes: Record<string, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
    };
    const variants: Record<string, string> = {
      primary:
        'bg-violet-500 text-white hover:bg-violet-400 active:bg-violet-600 ' +
        'shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_8px_24px_-12px_rgba(139,92,246,0.6)] ' +
        'hover:shadow-[0_0_0_1px_rgba(139,92,246,0.45),0_12px_28px_-10px_rgba(139,92,246,0.8)]',
      ghost:
        'bg-transparent text-white/80 hover:bg-white/[0.06] hover:text-white border border-white/[0.08]',
      subtle:
        'bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white',
      danger:
        'bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600 ' +
        'shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_8px_24px_-12px_rgba(239,68,68,0.6)]',
    };
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

// ─── Inputs ─────────────────────────────────────────────────────────────────

export const inputClass =
  'w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 ' +
  'text-sm text-white placeholder:text-white/30 ' +
  'focus:outline-none focus:border-violet-400/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-400/20 ' +
  'transition-colors duration-150 ' +
  REDUCE_MOTION_CLASS;

export const selectClass = inputClass + ' appearance-none pr-9';

// ─── Field wrapper ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  const errId = error ? `${htmlFor}-err` : undefined;
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-medium uppercase tracking-wide text-white/50"
      >
        {label}
      </label>
      {/* Inject aria-describedby into the child input/select. */}
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            { 'aria-describedby': errId } as Record<string, unknown>,
          )
        : children}
      {hint && !error && (
        <p className="text-[11px] text-white/40">{hint}</p>
      )}
      {error && (
        <p id={errId} className="text-[11px] text-red-300/90" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Card surface ───────────────────────────────────────────────────────────

interface CardProps {
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function Card({ className = '', children, onClick }: CardProps) {
  return (
    <div
      className={
        'rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm ' +
        className
      }
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={
        'animate-pulse rounded-md bg-white/[0.04] motion-reduce:animate-none ' +
        className
      }
      aria-hidden="true"
    />
  );
}

// ─── Inline icons (currentColor) ────────────────────────────────────────────

export function IconAlert({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 2.5 18 16.5H2L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.5" r="0.85" fill="currentColor" />
    </svg>
  );
}

export function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="m4.5 10.5 3.2 3.2L15.5 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClock({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v4.25l2.75 1.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconClose({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconEdit({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 17h3.5L16 7.5 12.5 4 3 13.5V17Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
