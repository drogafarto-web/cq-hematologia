/**
 * ConsentCaptureModal
 * LGPD Art. 9 consent capture dialog
 * Plain language, prominent, world-class accessibility
 */

import React, { useState } from 'react';
import type { ConsentScope } from '../types';

interface ConsentCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (scope: ConsentScope[]) => Promise<void>;
  labName?: string;
}

export const ConsentCaptureModal: React.FC<ConsentCaptureModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  labName = 'Laboratório',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!isChecked) return;

    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(['ia-strip']);
      setIsChecked(false);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao capturar consentimento'
      );
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal card */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg mx-4">
        <div className="bg-[#1a1a1e] rounded-lg border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white/95">
              Autorizar processamento com IA
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Processamento automatizado de análise de urina
            </p>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Explanation */}
            <div className="p-4 bg-white/2 rounded-lg border border-white/5">
              <p className="text-sm text-white/80 leading-relaxed">
                O <strong>{labName}</strong> utiliza tecnologia de IA para realizar
                análise automática de resultados de uroanálise. Isso permite:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Análise mais rápida dos seus resultados</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Maior precisão nos valores detectados</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Todos os resultados são revisados por profissionais</span>
                </li>
              </ul>
            </div>

            {/* LGPD notice */}
            <div className="text-xs text-white/50 leading-relaxed">
              <p>
                Seus dados são tratados conforme a LGPD. Você pode revisar nossa{' '}
                <button
                  className="text-violet-400 hover:text-violet-300 underline"
                  onClick={() => {
                    /* Open policy modal */
                  }}
                >
                  Política de Privacidade
                </button>
                .
              </p>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                disabled={isLoading}
                className="mt-1 w-5 h-5 rounded border-white/30 accent-violet-500 cursor-pointer"
                aria-label="Consinto com processamento de análise de urina automatizada"
              />
              <span className="text-sm text-white/80">
                Consinto com o processamento de análise de urina automatizada pelo{' '}
                <strong>{labName}</strong>.
              </span>
            </label>

            {/* Error state */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/12 border border-red-500/30">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/5 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white/95 transition-colors disabled:opacity-50"
            >
              Recusar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isChecked || isLoading}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processando...' : 'Autorizar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
