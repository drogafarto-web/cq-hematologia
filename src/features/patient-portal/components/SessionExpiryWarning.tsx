/**
 * SessionExpiryWarning — Modal countdown with expiry handling
 * RDC 978 Art. 167 — Session management + user notification
 *
 * Shows when session has <10 minutes remaining. Auto-focuses "Continue" button.
 * Allows refresh token or immediate logout.
 *
 * Props:
 *   - isOpen: boolean to control visibility
 *   - timeRemaining: milliseconds remaining
 *   - onContinue: callback to refresh token
 *   - onLogout: callback to logout
 *   - labName: lab name for context
 */

import React, { useEffect, useState } from 'react';

export interface SessionExpiryWarningProps {
  isOpen: boolean;
  timeRemaining: number; // milliseconds
  onContinue: () => void;
  onLogout: () => void;
  labName?: string;
}

export const SessionExpiryWarning = React.memo(function SessionExpiryWarning({
  isOpen,
  timeRemaining,
  onContinue,
  onLogout,
  labName = 'Lab',
}: SessionExpiryWarningProps) {
  const [displayTime, setDisplayTime] = useState('');
  const continueRef = React.useRef<HTMLButtonElement>(null);

  // Update formatted time every second
  useEffect(() => {
    if (!isOpen) return;

    const updateTime = () => {
      const minutes = Math.floor(timeRemaining / 60000);
      const seconds = Math.floor((timeRemaining % 60000) / 1000);
      setDisplayTime(`${minutes}m ${seconds}s`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeRemaining]);

  // Auto-focus continue button on open
  useEffect(() => {
    if (isOpen && continueRef.current) {
      continueRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onLogout]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="expiry-title"
          aria-describedby="expiry-desc"
          className={`
            bg-gradient-to-b from-slate-800 to-slate-900
            border border-orange-500/30 rounded-xl
            shadow-2xl max-w-sm w-full
            overflow-hidden animate-in fade-in scale-95
          `}
        >
          {/* Header */}
          <div className="bg-orange-500/20 border-b border-orange-500/30 px-6 py-4">
            <h2
              id="expiry-title"
              className="text-lg font-semibold text-orange-300 flex items-center gap-2"
            >
              <span aria-hidden="true">⏱️</span>
              Sua sessão está prestes a expirar
            </h2>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            <p
              id="expiry-desc"
              className="text-sm text-slate-300 leading-relaxed"
            >
              Você tem <span className="font-semibold text-orange-300">{displayTime}</span> de acesso
              ao portal de {labName} antes que sua sessão expire por segurança.
            </p>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs text-orange-200">
                <strong>Dica:</strong> Clique em "Continuar sessão" para renovar seu acesso.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-6 py-4 border-t border-white/8 bg-slate-950/40">
            <button
              ref={continueRef}
              onClick={onContinue}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium
                bg-emerald-500/20 hover:bg-emerald-500/30
                text-emerald-300 border border-emerald-500/30
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-emerald-500/50
              `}
              aria-label="Continuar sessão"
            >
              Continuar sessão
            </button>

            <button
              onClick={onLogout}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium
                bg-red-500/20 hover:bg-red-500/30
                text-red-300 border border-red-500/30
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-red-500/50
              `}
              aria-label="Fazer logout agora"
            >
              Logout
            </button>
          </div>

          {/* Footer */}
          <div className="text-xs text-slate-500 text-center px-6 py-3 border-t border-white/8">
            Pressione <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-300">Esc</kbd> para fazer logout.
          </div>
        </div>
      </div>
    </>
  );
});

SessionExpiryWarning.displayName = 'SessionExpiryWarning';
