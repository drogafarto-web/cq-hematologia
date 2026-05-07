/**
 * ChainValidatorModal.tsx
 *
 * Modal component for validating audit trail chain hash integrity.
 * User triggered or scheduled validation with real-time status display.
 *
 * Props:
 * - open: controls modal visibility
 * - labId: tenant identifier
 * - onClose: callback when user closes modal
 *
 * Behavior:
 * 1. Modal opens → immediately calls validateChain callable
 * 2. Spinner during validation with "Verificando..." message
 * 3. On success: green checkmark + "Trilha íntegra" OR red X + violations if broken
 * 4. Footer shows: last check time + refresh button + close button
 * 5. Violations can be exported via "Exportar relatório" button
 *
 * Compliance: RDC 978 Art. 5.3 — chain integrity audit, tamper detection
 */

import React, { useEffect, useState } from 'react';
import { callValidateChain, type CallValidateChainResult } from '../services/auditCallables';
import type { LabId } from '../types/shared_refs';

interface ChainValidatorModalProps {
  open: boolean;
  labId: LabId;
  onClose: () => void;
}

interface ValidationState {
  validating: boolean;
  result: CallValidateChainResult | null;
  lastCheckTime: number | null;
  error: Error | null;
  timeoutWarning: boolean;
}

const VALIDATION_TIMEOUT_MS = 30000; // 30s timeout

export function ChainValidatorModal({ open, labId, onClose }: ChainValidatorModalProps) {
  const [state, setState] = useState<ValidationState>({
    validating: false,
    result: null,
    lastCheckTime: null,
    error: null,
    timeoutWarning: false,
  });

  // Validate chain on modal open
  useEffect(() => {
    if (!open) return;

    const validateChainIntegrity = async () => {
      setState((prev) => ({
        ...prev,
        validating: true,
        error: null,
        timeoutWarning: false,
      }));

      const timeoutId = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          timeoutWarning: true,
        }));
      }, VALIDATION_TIMEOUT_MS);

      try {
        const result = await callValidateChain({ labId });
        clearTimeout(timeoutId);

        setState((prev) => ({
          ...prev,
          result,
          lastCheckTime: Date.now(),
          validating: false,
          timeoutWarning: false,
        }));
      } catch (err) {
        clearTimeout(timeoutId);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err : new Error('Erro desconhecido ao validar'),
          validating: false,
          timeoutWarning: false,
        }));
      }
    };

    validateChainIntegrity();
  }, [open, labId]);

  const handleRefresh = async () => {
    setState((prev) => ({
      ...prev,
      validating: true,
      error: null,
      timeoutWarning: false,
    }));

    const timeoutId = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        timeoutWarning: true,
      }));
    }, VALIDATION_TIMEOUT_MS);

    try {
      const result = await callValidateChain({ labId });
      clearTimeout(timeoutId);

      setState((prev) => ({
        ...prev,
        result,
        lastCheckTime: Date.now(),
        validating: false,
        timeoutWarning: false,
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Erro desconhecido ao validar'),
        validating: false,
        timeoutWarning: false,
      }));
    }
  };

  const handleExportReport = () => {
    if (!state.result) return;

    // Build report text
    const timestamp = new Date().toISOString();
    const status = state.result.status === 'valido' ? 'VÁLIDA' : 'QUEBRADA';
    const reportText = `RELATÓRIO DE VALIDAÇÃO DE TRILHA DE AUDITORIA
=====================================

Lab ID: ${labId}
Data/Hora: ${timestamp}
Status: ${status}

${
  state.result.status === 'valido'
    ? 'Trilha íntegra — nenhuma violação detectada'
    : `Violação detectada:
   Documento: ${state.result.firstViolation?.docId}
   Índice: ${state.result.firstViolation?.index}
   Hash esperado: ${state.result.firstViolation?.expectedHash}
   Hash atual: ${state.result.firstViolation?.actualHash}`
}

=====================================
Relatório gerado automaticamente`;

    // Trigger download
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(reportText)
    );
    element.setAttribute(
      'download',
      `auditoria-validacao-${labId}-${new Date().toISOString().split('T')[0]}.txt`
    );
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#141417] border border-white/10 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Validar Integridade da Trilha</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {state.validating ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
              </div>
              <p className="text-sm text-white/60">Verificando...</p>
              {state.timeoutWarning && (
                <p className="text-xs text-amber-400 text-center">
                  A validação está demorando. Pode haver muitos documentos.
                </p>
              )}
            </div>
          ) : state.error ? (
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-400">{state.error.message}</p>
              </div>
            </div>
          ) : state.result ? (
            <div className="flex flex-col items-center justify-center gap-4">
              {state.result.status === 'valido' ? (
                <>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <svg
                      className="w-6 h-6 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-emerald-400">Trilha íntegra</p>
                    <p className="text-xs text-white/60 mt-1">Nenhuma violação detectada</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30">
                    <svg
                      className="w-6 h-6 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-red-400">Trilha quebrada</p>
                    <p className="text-xs text-white/60 mt-2">
                      Violação detectada no documento:
                    </p>
                    {state.result.firstViolation && (
                      <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/20 text-left">
                        <p className="text-xs font-mono text-red-300 break-all">
                          {state.result.firstViolation.docId}
                        </p>
                        <p className="text-xs text-white/60 mt-2">
                          Índice: {state.result.firstViolation.index}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 space-y-3">
          {state.lastCheckTime && (
            <p className="text-xs text-white/50 text-center">
              Última verificação:{' '}
              {new Date(state.lastCheckTime).toLocaleTimeString('pt-BR')}
            </p>
          )}

          <div className="flex gap-2">
            {!state.validating && state.result?.status === 'quebrado' && (
              <button
                onClick={handleExportReport}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors text-sm font-medium"
                title="Exportar relatório de violação"
              >
                Exportar
              </button>
            )}

            {!state.validating && (
              <button
                onClick={handleRefresh}
                className="flex-1 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                Verificar novamente
              </button>
            )}

            <button
              onClick={onClose}
              disabled={state.validating}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
