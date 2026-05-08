/**
 * SuccessAlert — Dismissible success message with auto-dismiss
 * RDC 978 Art. 167 — User feedback for successful actions
 *
 * Props:
 *   - message: success text (required)
 *   - autoDismissMs?: milliseconds before auto-dismiss (default 5000)
 *   - onDismiss?: callback when dismissed
 */

import React, { useEffect } from 'react';

export interface SuccessAlertProps {
  message: string;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

export const SuccessAlert = React.memo(function SuccessAlert({
  message,
  autoDismissMs = 5000,
  onDismiss,
}: SuccessAlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  useEffect(() => {
    if (!autoDismissMs) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        rounded-lg p-4 flex items-center gap-3
        bg-emerald-500/10 border border-emerald-500/30
        transition-all duration-200 animate-in fade-in slide-in-from-top
      `}
    >
      {/* Checkmark icon */}
      <div className="flex-shrink-0 text-xl text-emerald-400" aria-hidden="true">
        ✓
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-emerald-300 font-medium">
        {message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className={`
          p-1 rounded-lg text-lg
          text-emerald-300 opacity-60 hover:opacity-100
          transition-opacity duration-150 flex-shrink-0
        `}
        aria-label="Fechar mensagem de sucesso"
      >
        ✕
      </button>
    </div>
  );
});

SuccessAlert.displayName = 'SuccessAlert';
