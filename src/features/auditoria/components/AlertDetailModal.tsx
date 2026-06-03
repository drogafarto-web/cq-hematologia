/**
 * SA-12: AlertDetailModal — Focus-trap dialog + acknowledge
 *
 * Modal dialog displaying alert details with acknowledge flow.
 * Implements focus trap, keyboard navigation, and accessible patterns.
 *
 * RDC 978 5.3 — audit trail with who/when context for NC investigation.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type { AnomalyAlert } from '../hooks/useAnomalyAlerts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertDetailModalProps {
  alert: AnomalyAlert | null;
  onClose: () => void;
  onAcknowledged?: (alertId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertDetailModal({
  alert,
  onClose,
  onAcknowledged,
}: AlertDetailModalProps): JSX.Element | null {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInteractiveRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (!alert) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    // Return focus to caller when closing
    const previousActiveElement = document.activeElement as HTMLElement;

    // Focus first interactive element
    setTimeout(() => firstInteractiveRef.current?.focus(), 100);

    // Keyboard handler
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = prevOverflow;
      previousActiveElement?.focus();
    };
  }, [alert, onClose]);

  if (!alert) {
    return null;
  }

  const handleAcknowledge = async () => {
    setAcknowledgeError(null);
    setIsAcknowledging(true);

    try {
      const acknowledgeAlert = httpsCallable(functions, 'acknowledgeAlert');
      await acknowledgeAlert({ alertId: alert.id, labId: alert.labId });

      onAcknowledged?.(alert.id);
      onClose();
    } catch (error) {
      setAcknowledgeError(error instanceof Error ? error.message : 'Erro ao reconhecer alerta');
      setIsAcknowledging(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl bg-[#141417] border border-white/10 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-detail-title"
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-[#141417]">
          <div>
            <h2 id="alert-detail-title" className="text-lg font-semibold text-white/90">
              Detalhes do alerta
            </h2>
            <p className="text-xs text-white/50 mt-1">{alert.scope}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 rounded-lg p-1"
            aria-label="Fechar modal"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 p-6">
          {/* Description */}
          <div>
            <p className="text-sm text-white/90 leading-6">{alert.shortDescription}</p>
          </div>

          {/* Evidence */}
          <div>
            <h3 className="text-xs font-semibold text-white/70 tracking-wider uppercase mb-3">
              Evidências
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-3 rounded-md bg-white/5">
                <span className="text-white/60">Detectado em</span>
                <span className="text-white/90 font-mono text-xs tabular-nums">
                  {new Date(alert.detectedAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-md bg-white/5">
                <span className="text-white/60">Severidade</span>
                <span className="text-white/90 font-medium">
                  {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                </span>
              </div>
              {alert.acknowledgedAt && (
                <div className="flex justify-between p-3 rounded-md bg-white/5">
                  <span className="text-white/60">Reconhecido em</span>
                  <span className="text-white/90 font-mono text-xs tabular-nums">
                    {new Date(alert.acknowledgedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pattern Summary */}
          <div>
            <h3 className="text-xs font-semibold text-white/70 tracking-wider uppercase mb-3">
              Padrão detectado
            </h3>
            <p className="text-sm text-white/70 leading-6 p-3 rounded-md bg-white/5">
              {alert.patternSummary}
            </p>
          </div>

          {/* Recommendations */}
          {alert.recommendations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-white/70 tracking-wider uppercase mb-3">
                Ações recomendadas
              </h3>
              <ul className="space-y-2">
                {alert.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 text-sm text-white/70 p-2 rounded-md hover:bg-white/5"
                  >
                    <span className="text-emerald-400 flex-shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error */}
          {acknowledgeError && (
            <div className="p-3 rounded-md bg-rose-500/15 border border-rose-400/30 text-sm text-rose-200">
              {acknowledgeError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t border-white/10 bg-[#141417]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white/90 bg-white/5 hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            Fechar
          </button>
          <button
            ref={firstInteractiveRef}
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            aria-label="Reconhecer alerta"
          >
            {isAcknowledging ? (
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Reconhecendo...
              </span>
            ) : (
              'Reconhecer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
