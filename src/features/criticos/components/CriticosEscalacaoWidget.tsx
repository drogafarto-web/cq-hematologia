/**
 * CriticosEscalacaoWidget
 * Displays critical value escalation status in laudo view
 *
 * Shows:
 * - SMS/Email delivery status
 * - SLA tracking (em_prazo / vencido)
 * - Physician acknowledgment status
 * - Retry actions (if available)
 */

import React, { useMemo } from 'react';
import type { CriticosEscalacao } from '../types';

interface CriticosEscalacaoWidgetProps {
  escalacao: CriticosEscalacao;
  onAcknowledge?: (escalacaoId: string) => void;
  onRetry?: (escalacaoId: string, canal: 'SMS' | 'EMAIL') => void;
}

export function CriticosEscalacaoWidget({
  escalacao,
  onAcknowledge,
  onRetry,
}: CriticosEscalacaoWidgetProps) {
  const statusColor = useMemo(() => {
    switch (escalacao.status) {
      case 'reconhecido':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'cancelado':
        return 'bg-slate-50 border-slate-200 text-slate-900';
      default:
        return escalacao.sla_status === 'vencido'
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-amber-50 border-amber-200 text-amber-900';
    }
  }, [escalacao.status, escalacao.sla_status]);

  const statusIcon = useMemo(() => {
    switch (escalacao.status) {
      case 'reconhecido':
        return '✓';
      case 'cancelado':
        return '−';
      default:
        return escalacao.sla_status === 'vencido' ? '!' : '•';
    }
  }, [escalacao.status, escalacao.sla_status]);

  const slaDisplay = useMemo(() => {
    if (!escalacao.tempo_sla_ms) return null;
    const minutes = Math.floor(escalacao.tempo_sla_ms / 60000);
    const seconds = Math.floor((escalacao.tempo_sla_ms % 60000) / 1000);
    return `${minutes}m${seconds}s`;
  }, [escalacao.tempo_sla_ms]);

  const latestAttempt = escalacao.escalacoes[escalacao.escalacoes.length - 1];

  return (
    <div
      className={`border rounded-lg p-4 space-y-3 ${statusColor}`}
      role="region"
      aria-label="Critical value escalation status"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{statusIcon}</span>
          <h3 className="font-semibold text-sm">
            {escalacao.status === 'reconhecido'
              ? 'Crítico Reconhecido'
              : escalacao.status === 'cancelado'
                ? 'Crítico Cancelado'
                : 'Crítico em Escalação'}
          </h3>
        </div>
        <span className="text-xs font-mono">
          {escalacao.analitoId}: {escalacao.valorObtido}
        </span>
      </div>

      {/* Details */}
      <div className="text-xs space-y-1">
        <p>
          <strong>Paciente:</strong> {escalacao.pacienteNome} ({escalacao.pacienteIdade}a)
        </p>
        <p>
          <strong>Médico:</strong> {escalacao.medicoNome}
        </p>
        {escalacao.motivo && (
          <p>
            <strong>Motivo:</strong> {escalacao.motivo}
          </p>
        )}
      </div>

      {/* Escalacao Attempts */}
      {escalacao.escalacoes.length > 0 && (
        <div className="text-xs space-y-2 border-t border-current border-opacity-20 pt-2">
          {escalacao.escalacoes.map((attempt, idx) => (
            <div key={attempt.canalId} className="flex items-center justify-between">
              <span>
                Tentativa {attempt.tentativa_numero} ({attempt.canal}):
                <span className="font-mono ml-1">
                  {attempt.status === 'entregue'
                    ? '✓ Entregue'
                    : attempt.status === 'falha'
                      ? '✗ Falha'
                      : attempt.status === 'enviado'
                        ? '→ Enviado'
                        : attempt.status}
                </span>
              </span>
              {attempt.motivo_falha && (
                <span className="text-opacity-60 ml-2">{attempt.motivo_falha}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SLA Status */}
      {escalacao.tempo_sla_ms && (
        <div className="text-xs border-t border-current border-opacity-20 pt-2">
          <p>
            <strong>SLA:</strong> {slaDisplay} / {escalacao.sla_minutos_target} min{' '}
            <span className="font-mono">
              [{escalacao.sla_status === 'vencido' ? 'VENCIDO' : 'em prazo'}]
            </span>
          </p>
        </div>
      )}

      {/* Acknowledgment */}
      {escalacao.reconhecido_em && (
        <div className="text-xs border-t border-current border-opacity-20 pt-2">
          <p>
            <strong>Reconhecido:</strong>{' '}
            {new Date(escalacao.reconhecido_em.toMillis()).toLocaleString('pt-BR')}
          </p>
        </div>
      )}

      {/* Actions */}
      {escalacao.status === 'enviado' && (
        <div className="flex gap-2 border-t border-current border-opacity-20 pt-2">
          {onAcknowledge && (
            <button
              onClick={() => onAcknowledge(escalacao.id)}
              className="text-xs px-2 py-1 bg-current bg-opacity-20 hover:bg-opacity-30 rounded transition"
              aria-label="Acknowledge critical value"
            >
              Reconhecer
            </button>
          )}
          {onRetry && latestAttempt?.status === 'falha' && (
            <button
              onClick={() => {
                const nextCanal = latestAttempt.canal === 'SMS' ? 'EMAIL' : 'SMS';
                onRetry(escalacao.id, nextCanal as 'SMS' | 'EMAIL');
              }}
              className="text-xs px-2 py-1 bg-current bg-opacity-20 hover:bg-opacity-30 rounded transition"
              aria-label={`Retry via ${latestAttempt.canal === 'SMS' ? 'email' : 'SMS'}`}
            >
              Reenviar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
