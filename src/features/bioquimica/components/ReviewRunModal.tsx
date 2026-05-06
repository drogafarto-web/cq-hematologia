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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" role="presentation">
      <div className="bg-[#141417] border border-white/[0.09] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl" role="dialog" aria-labelledby="review-modal-title">
        {/* Header */}
        <div className="sticky top-0 bg-white/[0.02] border-b border-white/[0.09] px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 id="review-modal-title" className="text-lg font-semibold text-white/90">Revisão de Corrida</h2>
              <p className="text-xs text-white/40 mt-1">
                {new Date(run.criadoEm.toMillis()).toLocaleString('pt-BR')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#141417] rounded-lg p-1.5 transition-colors"
              aria-label="Fechar diálogo"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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
              <p className="text-white/40">Equipamento</p>
              <p className="text-white/90 font-medium">{run.equipmentId}</p>
            </div>
            <div>
              <p className="text-white/40">Lote</p>
              <p className="text-white/90 font-medium">{run.lotId}</p>
            </div>
          </div>

          {/* Resultados table */}
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-3">Resultados</h3>
            <div className="overflow-x-auto rounded-lg border border-white/[0.09]">
              <table className="w-full text-xs" role="table" aria-label="Resultados detalhados da corrida">
                <thead>
                  <tr className="border-b border-white/[0.09] bg-white/[0.02]">
                    <th className="text-left px-3 py-2.5 text-white/40 font-medium" scope="col">Analito</th>
                    <th className="text-left px-3 py-2.5 text-white/40 font-medium" scope="col">Nível</th>
                    <th className="text-right px-3 py-2.5 text-white/40 font-medium" scope="col">Valor</th>
                    <th className="text-left px-3 py-2.5 text-white/40 font-medium" scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {analitos.map((analito) => {
                    // Get niveis from analito — type depends on Analito interface
                    const niveis = (analito as any).niveis || [];
                    return niveis.map((nivel: string) => {
                      const resultado = run.resultados?.[analito.id]?.[nivel];
                      const violations = Array.isArray((run as any).violations) ? [] : [];

                      return (
                        <tr key={`${analito.id}-${nivel}`} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-3 text-white/70">{analito.nome}</td>
                          <td className="px-3 py-3 text-white/50">{nivel}</td>
                          <td className="text-right px-3 py-3 text-white/90 font-mono tabular-nums">
                            {resultado ? resultado.toFixed(2) : '—'}
                          </td>
                          <td className="px-3 py-3">
                            {violations.length > 0 ? (
                              <ViolationChips violations={violations} />
                            ) : (
                              <span className="text-emerald-400/80 text-xs font-medium">✓</span>
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
            className={`p-4 rounded-lg border ${
              hasRejectViolations
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20'
            }`}
            role="status"
            aria-live="polite"
          >
            <p className="text-xs text-white/40 mb-1.5">Sugestão do sistema:</p>
            <p className={`text-sm font-semibold ${
              hasRejectViolations ? 'text-red-300' : 'text-emerald-300'
            }`}>
              {hasRejectViolations ? '⚠ Rejeitada — violação(ões) detectada(s)' : '✓ Aprovada — dentro da conformidade'}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white/[0.02] border-t border-white/[0.09] px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting || isLoading}
            className="px-4 py-2.5 text-sm font-medium text-white/70 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg border border-white/[0.09] transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>

          {hasRejectViolations && (
            <button
              onClick={() => setShowOverride(true)}
              disabled={submitting || isLoading}
              className="px-4 py-2.5 text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 rounded-lg border border-amber-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Override Auditado
            </button>
          )}

          <button
            onClick={handleApprove}
            disabled={submitting || isLoading}
            className="px-4 py-2.5 text-sm font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 rounded-lg border border-emerald-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={submitting}
          >
            {submitting ? 'Processando...' : 'Aprovar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewRunModal;
