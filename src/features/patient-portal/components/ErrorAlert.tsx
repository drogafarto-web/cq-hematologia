/**
 * ErrorAlert — Inline error messages with accessibility
 * RDC 978 Art. 167 — Accessible error communication
 *
 * Props:
 *   - message: error text (required)
 *   - type: 'auth' | 'email' | 'session' | 'network' (for icon/styling)
 *   - actionLabel?: button text (e.g. "Try again")
 *   - onAction?: callback when button clicked
 *   - onDismiss?: callback when X clicked (if provided, shows X button)
 *   - ariaDescribedBy?: id of element this error describes
 */

import React from 'react';

export interface ErrorAlertProps {
  message: string;
  type?: 'auth' | 'email' | 'session' | 'network' | 'validation';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
}

const iconByType = {
  auth: '🔐',
  email: '✉️',
  session: '⏱️',
  network: '🌐',
  validation: '⚠️',
};

const bgByType = {
  auth: 'bg-red-500/10 border border-red-500/30',
  email: 'bg-red-500/10 border border-red-500/30',
  session: 'bg-orange-500/10 border border-orange-500/30',
  network: 'bg-red-500/10 border border-red-500/30',
  validation: 'bg-yellow-500/10 border border-yellow-500/30',
};

const textColorByType = {
  auth: 'text-red-300',
  email: 'text-red-300',
  session: 'text-orange-300',
  network: 'text-red-300',
  validation: 'text-yellow-300',
};

const buttonColorByType = {
  auth: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',
  email: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',
  session: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/30',
  network: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/30',
  validation: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/30',
};

export const ErrorAlert = React.forwardRef<HTMLDivElement, ErrorAlertProps>(
  (
    {
      message,
      type = 'validation',
      actionLabel,
      onAction,
      onDismiss,
      ariaDescribedBy,
      autoFocus = false,
    },
    ref,
  ) => {
    const icon = iconByType[type];
    const bgClass = bgByType[type];
    const textClass = textColorByType[type];
    const buttonClass = buttonColorByType[type];

    const alertId = React.useId();
    const describedById = ariaDescribedBy || alertId;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-describedby={describedById}
        className={`
          rounded-lg p-4 flex items-start gap-3
          ${bgClass} transition-all duration-200
        `}
        tabIndex={autoFocus ? 0 : -1}
        autoFocus={autoFocus}
      >
        {/* Icon */}
        <div className="flex-shrink-0 text-xl mt-0.5" aria-hidden="true">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p id={alertId} className={`text-sm ${textClass} leading-snug`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium
                border transition-colors duration-150
                ${buttonClass}
              `}
              aria-label={actionLabel}
            >
              {actionLabel}
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`
                p-1 rounded-lg text-lg
                ${textClass} opacity-60 hover:opacity-100
                transition-opacity duration-150
              `}
              aria-label="Fechar mensagem de erro"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  },
);

ErrorAlert.displayName = 'ErrorAlert';
