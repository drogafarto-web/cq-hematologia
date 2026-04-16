import React, { useEffect, useRef } from 'react';
import { useToastStore } from '../../store/useToastStore';
import type { ToastItem } from '../../store/useToastStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2L1.5 13.5h13L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: <SuccessIcon />,
    bg:   'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-500/25',
    text: 'text-emerald-800 dark:text-emerald-300',
    bar:  'bg-emerald-500',
  },
  error: {
    icon: <ErrorIcon />,
    bg:   'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-500/25',
    text: 'text-red-800 dark:text-red-300',
    bar:  'bg-red-500',
  },
  warning: {
    icon: <WarningIcon />,
    bg:   'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-500/25',
    text: 'text-amber-800 dark:text-amber-300',
    bar:  'bg-amber-500',
  },
  info: {
    icon: <InfoIcon />,
    bg:   'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-500/25',
    text: 'text-blue-800 dark:text-blue-300',
    bar:  'bg-blue-500',
  },
} as const;

// ─── Single Toast ─────────────────────────────────────────────────────────────

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const cfg = TOAST_CONFIG[toast.type];
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    // Trigger CSS transition for progress bar
    requestAnimationFrame(() => {
      bar.style.width = '0%';
    });
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 w-full max-w-sm rounded-xl border shadow-lg
        ${cfg.bg} overflow-hidden toast-enter
      `}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/5 dark:bg-white/5">
        <div
          ref={barRef}
          className={`h-full ${cfg.bar} opacity-50 transition-all`}
          style={{ width: '100%', transitionDuration: '3500ms', transitionTimingFunction: 'linear' }}
        />
      </div>

      <div className={`flex items-start gap-3 px-4 py-3.5 w-full relative ${cfg.text}`}>
        <span className="shrink-0 mt-0.5">{cfg.icon}</span>
        <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Fechar notificação"
          className="shrink-0 -mr-2 -mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl opacity-50 hover:opacity-100 transition-opacity"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

/**
 * ToastContainer — renders a stack of toasts in the bottom-center of the
 * viewport. Mount once in App.tsx (outside any scroll container).
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notificações"
      className="fixed bottom-safe-4 bottom-4 inset-x-0 z-[9999] flex flex-col-reverse items-center gap-2 px-4 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm relative">
          <ToastCard toast={t} onDismiss={remove} />
        </div>
      ))}
    </div>
  );
}
