/**
 * ReAuditoriaCard — Visual indicator + trigger for re-audit workflow
 *
 * Shows audit status + conditional "Create Re-Audit" button when:
 * - status === 'finalizada'
 * - tipoExecucao !== 'reAuditoria' (not already a re-audit)
 * - Has closed non-conformances (achados com statusNC === 'fechada')
 *
 * Dark-first design: card with status badge, visual hierarchy.
 * Responsive for tablet + desktop.
 */

import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import type { Auditoria } from '../types';
import { functions } from '../../../shared/services/firebase';

interface ReAuditoriaCardProps {
  auditoria: Auditoria;
  onCreateReAuditoria: () => void;
  hasClosedNCs?: boolean; // Helper: true if audit has closed non-conformances
}

export function ReAuditoriaCard({
  auditoria,
  onCreateReAuditoria,
  hasClosedNCs = false,
}: ReAuditoriaCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Determine if re-audit button should be visible
  const isFinalized = auditoria.status === 'finalizada';
  const tipoExecucao = (auditoria as Auditoria & { tipoExecucao?: 'inicial' | 'reAuditoria' }).tipoExecucao;
  const isNotReAudit = !tipoExecucao || tipoExecucao !== 'reAuditoria';
  const shouldShowButton = isFinalized && isNotReAudit && hasClosedNCs;

  // Status badge styling
  const statusConfig = {
    planejada: {
      label: 'Planejada',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400',
      dotColor: 'bg-blue-500',
    },
    em_execução: {
      label: 'Em Execução',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      dotColor: 'bg-yellow-500',
    },
    finalizada: {
      label: 'Finalizada',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
  };

  const statusColor = statusConfig[auditoria.status] || statusConfig.planejada;

  const handleCreateReAuditoria = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const callable = httpsCallable(functions, 'createReAuditoria');
      await callable({
        labId: auditoria.labId,
        auditoriaOriginalId: auditoria.id,
      });

      // Callback to parent (typically triggers refetch)
      onCreateReAuditoria();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-lg p-6 bg-gradient-to-br from-white/5 to-transparent hover:border-white/20 transition-all">
      {/* Header: Year + Status */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-sm text-white/60 mb-1">Auditoria</div>
          <h3 className="text-2xl font-semibold">{auditoria.ano}</h3>
        </div>

        {/* Status badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusColor.bgColor}`}
        >
          <div className={`w-2 h-2 rounded-full ${statusColor.dotColor}`} />
          <span className={`text-sm font-medium ${statusColor.textColor}`}>
            {statusColor.label}
          </span>
        </div>
      </div>

      {/* Meta info */}
      <div className="space-y-3 mb-6 text-sm text-white/70">
        <div className="flex justify-between">
          <span>Frequência:</span>
          <span className="text-white/90 capitalize">
            {auditoria.frequencia}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Responsável Técnico:</span>
          <span className="text-white/90">{auditoria.responsavelTecnico}</span>
        </div>
        {tipoExecucao === 'reAuditoria' && (
          <div className="flex justify-between">
            <span>Tipo:</span>
            <span className="text-violet-400">Re-auditoria</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {/* Create Re-Audit button */}
      {shouldShowButton && (
        <button
          onClick={handleCreateReAuditoria}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            isLoading
              ? 'bg-violet-500/50 text-white/70 cursor-not-allowed'
              : 'bg-violet-500 text-white hover:bg-violet-600 active:scale-95'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Criando...</span>
            </>
          ) : (
            <>
              <span className="text-lg">↻</span>
              <span>Criar Re-auditoria</span>
            </>
          )}
        </button>
      )}

      {/* Info: why button is hidden */}
      {!shouldShowButton && isFinalized && (
        <div className="text-xs text-white/50 text-center py-2">
          {!isNotReAudit && 'Já é uma re-auditoria'}
          {isNotReAudit && !hasClosedNCs && 'Nenhuma não-conformidade fechada'}
        </div>
      )}
    </div>
  );
}
