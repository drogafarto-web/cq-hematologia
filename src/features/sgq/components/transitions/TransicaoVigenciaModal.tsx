/**
 * TransicaoVigenciaModal.tsx
 *
 * RT approval modal for document status transition.
 * Includes RTSignatureGate (PIN) + reason input.
 */

import { useState } from 'react';
import type { StatusVigencia } from '../lm/StatusVigenciaBadge';
import { StatusVigenciaBadge } from '../lm/StatusVigenciaBadge';

interface TransicaoVigenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    codigo: string;
    titulo: string;
    currentStatus: StatusVigencia;
  };
  nextStatus: StatusVigencia;
  onConfirm?: (reason: string, pin: string) => Promise<void>;
  loading?: boolean;
}

const VALID_TRANSITIONS: Record<StatusVigencia, StatusVigencia[]> = {
  'draft': ['em-revisao'],
  'em-revisao': ['vigente', 'draft'],
  'vigente': ['obsoleto', 'em-revisao'],
  'obsoleto': ['vigente'],
};

function getReasonLabel(from: StatusVigencia, to: StatusVigencia): string {
  if (from === 'draft' && to === 'em-revisao') return 'Motivo da Submissão';
  if (from === 'em-revisao' && to === 'vigente') return 'Motivo da Aprovação';
  if (from === 'em-revisao' && to === 'draft') return 'Motivo da Rejeição';
  if (from === 'vigente' && to === 'obsoleto') return 'Motivo da Obsolescência';
  if (from === 'vigente' && to === 'em-revisao') return 'Motivo da Revisão';
  if (from === 'obsoleto' && to === 'vigente') return 'Motivo da Reativação';
  return 'Observações';
}

export function TransicaoVigenciaModal({
  isOpen,
  onClose,
  document,
  nextStatus,
  onConfirm,
  loading = false,
}: TransicaoVigenciaModalProps) {
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const isValidTransition = VALID_TRANSITIONS[document.currentStatus]?.includes(nextStatus) ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Por favor, forneça uma razão para a transição');
      return;
    }

    if (!pin) {
      setError('PIN de assinatura obrigatório');
      return;
    }

    try {
      await onConfirm?.(reason, pin);
      setReason('');
      setPin('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar transição');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#141417] border border-white/10 rounded-lg shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Transição de Documento</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white/60"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Document preview */}
          <div>
            <p className="text-xs text-white/60 uppercase font-semibold tracking-wide mb-2">Documento</p>
            <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="text-xs font-mono text-white/70">{document.codigo}</div>
              <div className="text-sm text-white mt-1 truncate">{document.titulo}</div>
            </div>
          </div>

          {/* Status transition */}
          <div>
            <p className="text-xs text-white/60 uppercase font-semibold tracking-wide mb-2">Transição de Status</p>
            <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
              <StatusVigenciaBadge status={document.currentStatus} showLabel tooltip={false} />
              <div className="text-white/40">→</div>
              <StatusVigenciaBadge status={nextStatus} showLabel tooltip={false} />
            </div>
            {!isValidTransition && (
              <p className="text-xs text-red-400 mt-2">
                Transição inválida: {document.currentStatus} para {nextStatus} não é permitida
              </p>
            )}
          </div>

          {/* Form */}
          {isValidTransition && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Reason */}
              <div>
                <label htmlFor="reason" className="text-xs text-white/60 uppercase font-semibold tracking-wide block mb-2">
                  {getReasonLabel(document.currentStatus, nextStatus)}
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                  placeholder="Descreva o motivo da transição..."
                  className="w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                  rows={4}
                />
              </div>

              {/* PIN (RTSignatureGate) */}
              <div>
                <label htmlFor="pin" className="text-xs text-white/60 uppercase font-semibold tracking-wide block mb-2">
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="inline mr-1"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  PIN de Assinatura RT
                </label>
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={loading}
                  placeholder="Seu PIN de 4 dígitos"
                  className="w-full px-3 py-2 bg-[#141417] border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                  maxLength={4}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !reason.trim() || !pin}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {loading ? 'Processando...' : 'Confirmar Transição'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
