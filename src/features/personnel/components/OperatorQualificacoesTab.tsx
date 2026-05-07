/**
 * OperatorQualificacoesTab.tsx
 *
 * Tab displaying operator qualifications (certifications) with expiry tracking.
 *
 * Props:
 * - operadorId: operator's user ID
 * - labId: tenant ID
 * - canEdit: whether revoke button is visible
 *
 * Features:
 * - Real-time subscription via useQualificacoes
 * - Expiry status badges (green/yellow/red or none)
 * - Revoke button (if canEdit) → confirm dialog → callRevogarQualificacao
 * - Empty state with conditional button
 * - WCAG AA compliant table + badges
 * - Responsive (scrollable on mobile)
 * - Dark mode (design system tokens)
 */

import React, { useState, useCallback } from 'react';
import { useQualificacoes } from '../hooks/useQualificacoes';
import { callRevogarQualificacao } from '../services/pessoaCallables';
import { toast } from '../../../shared/store/useToastStore';
import type { Qualificacao } from '../types';

type LabId = string;
type UserId = string;

interface OperatorQualificacoesTabProps {
  operadorId: UserId;
  labId: LabId;
  canEdit: boolean;
}

interface ConfirmState {
  qualificacaoId: string;
  tipo: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1 3h12M6 6v4M8 6v4M2.5 3l.8 8.4c.1.6.6 1.1 1.3 1.1h5.8c.7 0 1.2-.5 1.3-1.1L11.5 3M4.5 3V2c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 3v4M7 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Format date as DD/MM/YYYY.
 */
function formatDate(timestamp: any): string {
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Calculate days until expiry.
 */
function daysUntilExpiry(expiryTimestamp: any | null): number | null {
  if (!expiryTimestamp) return null;
  try {
    const expiryDate = expiryTimestamp.toDate ? expiryTimestamp.toDate() : new Date(expiryTimestamp);
    const today = new Date();
    const diffMs = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Get expiry status badge.
 */
interface ExpiryStatus {
  type: 'expired' | 'warning' | 'valid' | 'indefinite';
  label: string;
  ariaLabel: string;
}

function getExpiryStatus(validoAte: any | null): ExpiryStatus {
  if (!validoAte) {
    return {
      type: 'indefinite',
      label: '',
      ariaLabel: 'Qualificação indefinida',
    };
  }

  const daysLeft = daysUntilExpiry(validoAte);

  if (daysLeft === null) {
    return {
      type: 'indefinite',
      label: '',
      ariaLabel: 'Qualificação indefinida',
    };
  }

  if (daysLeft < 0) {
    return {
      type: 'expired',
      label: 'Expirado',
      ariaLabel: 'Qualificação expirada',
    };
  }

  if (daysLeft <= 30) {
    return {
      type: 'warning',
      label: `A vencer em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
      ariaLabel: `Qualificação a vencer em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
    };
  }

  return {
    type: 'valid',
    label: 'Válido',
    ariaLabel: 'Qualificação válida',
  };
}

/**
 * Confirm dialog for revoke.
 */
interface RevokeConfirmDialogProps {
  qualificacao: Qualificacao;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function RevokeConfirmDialog({
  qualificacao,
  loading,
  onConfirm,
  onCancel,
}: RevokeConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="revoke-title"
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-gradient-to-b from-[#141417] to-[#0a0a0b]
        border border-white/[0.08] shadow-2xl p-6">
        <h2 id="revoke-title" className="text-lg font-semibold text-white mb-2">
          Revogar qualificação?
        </h2>
        <p className="text-sm text-white/70 mb-6">
          Você está prestes a revogar a qualificação de <strong>{qualificacao.tipo}</strong> nos módulos{' '}
          <strong>{qualificacao.modulosLiberados.join(', ')}</strong>.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30
              text-red-300 hover:bg-red-500/30 disabled:opacity-50
              text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Revogando...' : 'Revogar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.09]
              text-white/70 hover:text-white/90 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main component.
 */
export function OperatorQualificacoesTab({
  operadorId,
  labId,
  canEdit,
}: OperatorQualificacoesTabProps) {
  const { qualificacoes, loading } = useQualificacoes({ operadorId });
  const [revoking, setRevoking] = useState<ConfirmState | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevokeClick = useCallback((qualificacao: Qualificacao) => {
    setRevoking({
      qualificacaoId: qualificacao.id,
      tipo: qualificacao.tipo,
    });
  }, []);

  const handleRevokeConfirm = useCallback(async () => {
    if (!revoking) return;

    setRevokeLoading(true);
    setError(null);

    try {
      await callRevogarQualificacao({
        labId,
        operadorId,
        qualificacaoId: revoking.qualificacaoId,
      });

      // Success: dialog closes automatically via state change when subscription updates
      toast.success('Qualificação revogada com sucesso');
      setRevoking(null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao revogar qualificação');
      setRevokeLoading(false);
    }
  }, [revoking, labId, operadorId]);

  const handleRevokeCancel = useCallback(() => {
    setRevoking(null);
  }, []);

  // Empty state
  if (!loading && qualificacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <div className="text-white/40 mb-4">
          <AlertCircleIcon />
        </div>
        <p className="text-center text-sm text-white/60 mb-4">
          Nenhuma qualificação registrada para este operador.
        </p>
        {canEdit && (
          <button
            type="button"
            className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30
              text-emerald-300 hover:bg-emerald-500/30 text-sm font-medium transition-colors"
          >
            Conceder qualificação
          </button>
        )}
      </div>
    );
  }

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-white/[0.05] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error toast */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3.5 flex gap-3 items-start">
          <div className="text-red-400 mt-0.5 shrink-0">
            <AlertCircleIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Table wrapper for responsiveness */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
        <table
          className="w-full text-sm"
          role="table"
          aria-label="Qualificações do operador"
        >
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02]">
              <th className="px-4 py-3 text-left font-medium text-white/60 text-xs">
                Tipo
              </th>
              <th className="px-4 py-3 text-left font-medium text-white/60 text-xs">
                Módulos
              </th>
              <th className="px-4 py-3 text-left font-medium text-white/60 text-xs">
                Válido de
              </th>
              <th className="px-4 py-3 text-left font-medium text-white/60 text-xs">
                Válido até
              </th>
              <th className="px-4 py-3 text-left font-medium text-white/60 text-xs">
                Status
              </th>
              {canEdit && (
                <th className="px-4 py-3 text-right font-medium text-white/60 text-xs">
                  Ação
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.08]">
            {qualificacoes.map((q) => {
              const expiryStatus = getExpiryStatus(q.validoAte);
              const statusColor =
                expiryStatus.type === 'expired'
                  ? 'text-red-300 bg-red-500/10 border-red-500/20'
                  : expiryStatus.type === 'warning'
                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                    : expiryStatus.type === 'valid'
                      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                      : 'hidden';

              const statusIcon =
                expiryStatus.type === 'expired'
                  ? AlertCircleIcon
                  : expiryStatus.type === 'valid'
                    ? CheckCircleIcon
                    : null;

              const StatusIcon = statusIcon;

              return (
                <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Tipo */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
                      bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                      {q.tipo}
                    </span>
                  </td>

                  {/* Módulos */}
                  <td className="px-4 py-3 text-white/70">
                    <div className="flex flex-wrap gap-1.5">
                      {q.modulosLiberados.map((m) => (
                        <span
                          key={m}
                          className="inline-flex px-2.5 py-1 rounded-md bg-white/[0.04]
                            border border-white/[0.08] text-white/60 text-xs"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Válido de */}
                  <td className="px-4 py-3 text-white/70">
                    {formatDate(q.validoDe)}
                  </td>

                  {/* Válido até */}
                  <td className="px-4 py-3 text-white/70">
                    {q.validoAte ? formatDate(q.validoAte) : '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {expiryStatus.type !== 'indefinite' ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
                          border text-xs font-medium ${statusColor}`}
                        aria-label={expiryStatus.ariaLabel}
                      >
                        {StatusIcon && (
                          <span className="shrink-0">
                            <StatusIcon />
                          </span>
                        )}
                        {expiryStatus.label}
                      </span>
                    ) : null}
                  </td>

                  {/* Ações */}
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevokeClick(q)}
                        aria-label={`Revogar qualificação de ${q.tipo}`}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white/70
                          hover:bg-white/[0.06] transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revoke confirm dialog */}
      {revoking && (
        <RevokeConfirmDialog
          qualificacao={qualificacoes.find((q) => q.id === revoking.qualificacaoId)!}
          loading={revokeLoading}
          onConfirm={handleRevokeConfirm}
          onCancel={handleRevokeCancel}
        />
      )}
    </div>
  );
}
