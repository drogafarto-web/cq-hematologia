import React, { useEffect, useRef } from 'react';
import { haptic } from '../hooks/useHaptic';

interface ConfirmModalProps {
  title: string;
  message: string;
  /** Label do botão de confirmação. Padrão: "Excluir" */
  confirmLabel?: string;
  /** Variante de cor do botão de confirmação. Padrão: "danger" */
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Excluir',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the cancel button for safety (prevents accidental confirm)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.25)]'
      : 'bg-amber-500 hover:bg-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.25)]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 modal-spring"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-modal-title" className="text-xl font-bold text-white mb-2">
          {title}
        </h3>
        <p id="confirm-modal-desc" className="text-sm text-white/70 mb-6 whitespace-pre-wrap leading-relaxed">
          {message}
        </p>

        {/* Buttons — full-width stacked for mobile, side-by-side on wider screens */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-6 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.07] transition-all order-2 sm:order-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { haptic.heavy(); onConfirm(); onCancel(); }}
            className={`min-h-[44px] px-6 rounded-xl text-sm font-semibold transition-all order-1 sm:order-2 ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
