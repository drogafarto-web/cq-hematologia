/**
 * CAPAStatusTransitionModal.tsx
 *
 * Form for initiating a CAPA status transition.
 * Validates transition rules and calls Cloud Function callable.
 */

import { useState } from 'react';
import type { CapaStateLegacy } from '../types';

interface CAPAStatusTransitionModalProps {
  capaId: string;
  currentStatus: CapaStateLegacy;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (toStatus: CapaStateLegacy, notes?: string) => Promise<void>;
}

/**
 * Valid transitions matrix.
 * Defines which status transitions are allowed.
 */
const VALID_TRANSITIONS: Record<CapaStateLegacy, CapaStateLegacy[]> = {
  aberto: ['em-andamento'],
  'em-andamento': ['evidencia-submetida'],
  'evidencia-submetida': ['auditor-revisando', 'em-andamento'],
  'auditor-revisando': ['fechado', 'evidencia-submetida'],
  fechado: [], // Terminal state
};

/**
 * Status labels for display.
 */
const STATUS_LABEL: Record<CapaStateLegacy, string> = {
  aberto: 'Aberto',
  'em-andamento': 'Em Andamento',
  'evidencia-submetida': 'Evidência Submetida',
  'auditor-revisando': 'Auditor Revisando',
  fechado: 'Fechado',
};

export function CAPAStatusTransitionModal({
  capaId,
  currentStatus,
  isOpen,
  onClose,
  onSubmit,
}: CAPAStatusTransitionModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<CapaStateLegacy | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  const canTransition = allowedTransitions.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus || !canTransition) return;

    setLoading(true);
    setError(null);

    try {
      await onSubmit?.(selectedStatus, notes || undefined);
      setSelectedStatus(null);
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`transition-modal-${capaId}`}
    >
      <div className="bg-[#141417] rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h2 id={`transition-modal-${capaId}`} className="text-lg font-semibold">
            Atualizar Status
          </h2>
          <p className="text-xs text-white/60 mt-1">
            CAPA {capaId} · Status atual: {STATUS_LABEL[currentStatus]}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {!canTransition ? (
            <div className="text-center py-4 text-white/60">
              <p className="text-sm">Status final — nenhuma transição permitida</p>
            </div>
          ) : (
            <>
              {/* Status selector */}
              <div>
                <label
                  htmlFor={`status-${capaId}`}
                  className="block text-xs font-medium text-white/70 mb-2"
                >
                  Novo Status
                </label>
                <select
                  id={`status-${capaId}`}
                  value={selectedStatus || ''}
                  onChange={(e) => setSelectedStatus(e.target.value as CapaStateLegacy)}
                  className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  required
                  aria-label="Selecione o novo status"
                >
                  <option value="">Selecione um status...</option>
                  {allowedTransitions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor={`notes-${capaId}`}
                  className="block text-xs font-medium text-white/70 mb-2"
                >
                  Observações (opcional)
                </label>
                <textarea
                  id={`notes-${capaId}`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Evidência adicional rejeitada — refazer análise"
                  className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  rows={3}
                  aria-label="Observações (opcional)"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 rounded-md bg-red-500/20 border border-red-500/50 text-sm text-red-200">
                  {error}
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancelar
          </button>
          {canTransition && (
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedStatus}
              className="px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              aria-label="Atualizar status"
            >
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
