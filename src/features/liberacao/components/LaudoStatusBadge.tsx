/**
 * LaudoStatusBadge — Renders 6 release states with semantic colors
 *
 * States:
 * - Pendente: gray
 * - Em Revisão: yellow (pulse animation)
 * - Liberado: green
 * - Auto-Liberado: violet
 * - Comunicado: emerald
 * - Superado: slate (strikethrough)
 */

import React from 'react';
import { ReleaseState } from '../types/releaseState';
import { stateLabel, stateColor } from '../utils/stateMachine';

interface LaudoStatusBadgeProps {
  status: ReleaseState;
  showLabel?: boolean;
  showTooltip?: boolean;
  lastTransitionInfo?: {
    ts: Date;
    operador: string;
  };
}

const colorMap: Record<ReleaseState, string> = {
  Pendente: 'bg-gray-600/20 border-gray-500/40 text-gray-300',
  'Em Revisão': 'bg-yellow-600/20 border-yellow-500/40 text-yellow-300 animate-pulse',
  Liberado: 'bg-green-600/20 border-green-500/40 text-green-300',
  'Auto-Liberado': 'bg-violet-600/20 border-violet-500/40 text-violet-300',
  Comunicado: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300',
  Superado: 'bg-slate-600/20 border-slate-500/40 text-slate-300 line-through',
};

const iconMap: Record<ReleaseState, string> = {
  Pendente: '⏳',
  'Em Revisão': '👁️',
  Liberado: '✅',
  'Auto-Liberado': '🤖',
  Comunicado: '📧',
  Superado: '♻️',
};

export function LaudoStatusBadge({
  status,
  showLabel = true,
  showTooltip = false,
  lastTransitionInfo,
}: LaudoStatusBadgeProps) {
  const label = stateLabel(status);
  const bgClass = colorMap[status] || colorMap.Pendente;

  const badge = (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-all ${bgClass}`}
      role="status"
      aria-label={label}
    >
      <span className="text-sm">{iconMap[status]}</span>
      {showLabel && <span>{status}</span>}
    </span>
  );

  if (!showTooltip || !lastTransitionInfo) {
    return badge;
  }

  return (
    <div className="group relative inline-block">
      {badge}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-white/95 text-slate-900 text-xs rounded-lg p-3 w-48 z-50 shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-slate-700">{lastTransitionInfo.ts.toLocaleString('pt-BR')}</p>
        <p className="text-slate-700">Operador: {lastTransitionInfo.operador}</p>
      </div>
    </div>
  );
}

export default LaudoStatusBadge;
