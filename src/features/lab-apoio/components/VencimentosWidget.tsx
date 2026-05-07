/**
 * VencimentosWidget.tsx — expiring contracts with countdown badges.
 * Red <7d, amber <30d, yellow <60d.
 * Tabular-nums on dates, color tokens.
 */

import React from 'react';
import type { ExpiryBin } from '../hooks/useExpiryAlerts';

interface VencimentosWidgetProps {
  expiryBins: ExpiryBin;
}

export function VencimentosWidget({ expiryBins }: VencimentosWidgetProps) {
  const allExpiring = [
    ...expiryBins['7d'],
    ...expiryBins['30d'],
    ...expiryBins['60d'],
    ...expiryBins.expired,
  ];

  if (allExpiring.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-8 text-center">
        <p className="text-white/50">Nenhum contrato vencendo nos próximos 60 dias</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allExpiring.map((contrato) => {
        const now = new Date().toISOString().split('T')[0];
        const daysUntil = Math.floor(
          (new Date(contrato.vigenciaFim).getTime() - new Date(now).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        let badgeClass = 'bg-white/10 text-white/70';
        if (daysUntil < 0) {
          badgeClass = 'bg-red-500/30 text-red-300 font-semibold';
        } else if (daysUntil <= 7) {
          badgeClass = 'bg-red-500/20 text-red-400 font-semibold';
        } else if (daysUntil <= 30) {
          badgeClass = 'bg-yellow-500/20 text-yellow-400';
        } else if (daysUntil <= 60) {
          badgeClass = 'bg-white/5 text-white/60';
        }

        return (
          <div
            key={contrato.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex-1">
              <h3 className="font-medium text-white">{contrato.nome}</h3>
              <p className="text-xs text-white/50 font-tabular-nums mt-1">
                Vencimento: {contrato.vigenciaFim}
              </p>
            </div>
            <div className={`px-3 py-1 rounded text-sm font-tabular-nums ${badgeClass}`}>
              {daysUntil < 0 ? (
                <span>VENCIDO {Math.abs(daysUntil)}d atrás</span>
              ) : (
                <span>{daysUntil} dias</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
