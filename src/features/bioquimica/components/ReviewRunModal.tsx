import React, { useState } from 'react';
import { Run, Analito } from '../types';
import ViolationChips from './ViolationChips';
import RunOverrideModal from './RunOverrideModal';

interface ReviewRunModalProps {
  run: Run;
  analitos: Analito[];
  onApprove: (status: 'Aprovada' | 'Rejeitada') => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const ReviewRunModal: React.FC<ReviewRunModalProps> = ({
  run,
  analitos,
  onApprove,
  onClose,
  isLoading = false,
}) => {
  const [showOverride, setShowOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await onApprove('Aprovada');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onApprove('Rejeitada');
    } finally {
      setSubmitting(false);
    }
  };

  if (showOverride) {
    return (
      <RunOverrideModal
        run={run}
        analitos={analitos}
        onOverride={async () => {
          await onApprove('Aprovada');
          onClose();
        }}
        onCancel={() => setShowOverride(false)}
        isLoading={submitting}
      />
    );
  }

  const hasRejectViolations = Object.values(run.violations || {}).some((anaViolations) =>
    Object.values(anaViolations).some((violations: any) =>
      Array.isArray(violations) && violations.some((v) => v.severity === 'reject')
    )
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Revisão de Corrida</h2>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(run.criadoEm.toMillis()).toLocaleString('pt-BR')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Fechar"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Run info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Equipamento</p>
              <p className="text-slate-200 font-medium">{run.equipmentId}</p>
            </div>
            <div>
              <p className="text-slate-500">Lote</p>
              <p className="text-slate-200 font-medium">{run.lotId}</p>
            </div>
          </div>

          {/* Resultados table */}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Resultados</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Analito</th>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Nível</th>
                    <th className="text-right px-3 py-2 text-slate-400 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analitos.map((analito) => {
                    // Get niveis from analito — type depends on Analito interface
                    const niveis = (analito as any).niveis || [];
                    return niveis.map((nivel: string) => {
                      const resultado = run.resultados?.[analito.id]?.[nivel];
                      const violations = Array.isArray((run as any).violations) ? [] : [];

                      return (
                        <tr key={`${analito.id}-${nivel}`} className="border-b border-slate-800">
                          <td className="px-3 py-3 text-slate-300">{analito.nome}</td>
                          <td className="px-3 py-3 text-slate-400">{nivel}</td>
                          <td className="text-right px-3 py-3 text-slate-200 font-mono tabular-nums">
                            {resultado ? resultado.toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-3">
                            {violations.length > 0 ? (
                              <ViolationChips violations={violations} />
                            ) : (
                              <span className="text-green-400/80 text-xs">✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status suggestion */}
          <div
            className={`p-3 rounded-lg border ${
              hasRejectViolations
                ? 'bg-red-900/20 border-red-700/50'
                : 'bg-green-900/20 border-green-700/50'
            }`}
          >
            <p className="text-xs text-slate-400 mb-1">Sugestão do sistema:</p>
            <p className={`text-sm font-semibold ${
              hasRejectViolations ? 'text-red-200' : 'text-green-200'
            }`}>
              {hasRejectViolations ? '❌ Rejeitada' : '✓ Aprovada'}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting || isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          {hasRejectViolations && (
            <button
              onClick={() => setShowOverride(true)}
              disabled={submitting || isLoading}
              className="px-4 py-2 text-sm font-medium text-amber-200 bg-amber-900/40 border border-amber-700/50 rounded-lg hover:bg-amber-900/60 transition-colors disabled:opacity-50"
            >
              Override Auditado
            </button>
          )}

          <button
            onClick={handleApprove}
            disabled={submitting || isLoading}
            className="px-4 py-2 text-sm font-medium text-green-200 bg-green-900/40 border border-green-700/50 rounded-lg hover:bg-green-900/60 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Processando...' : 'Aprovar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewRunModal;
