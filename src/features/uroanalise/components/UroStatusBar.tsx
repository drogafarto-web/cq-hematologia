import React from 'react';
import type { UroLotStatus } from '../types/_shared_refs';

interface UroStatusBarProps {
  status: UroLotStatus | 'nao_salvo';
  message?: string;
  timestamp?: string;
  operador?: string;
}

const STATUS_CONFIG: Record<
  UroStatusBarProps['status'],
  { dot: string; bg: string; text: string; label: string }
> = {
  sem_dados: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-500/5',
    text: 'text-slate-600 dark:text-slate-400',
    label: 'Sem dados',
  },
  valido: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Válido',
  },
  atencao: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/5',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Atenção',
  },
  reprovado: {
    dot: 'bg-red-500',
    bg: 'bg-red-500/5',
    text: 'text-red-700 dark:text-red-300',
    label: 'Inválido',
  },
  nao_salvo: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-500/5',
    text: 'text-slate-600 dark:text-slate-400',
    label: 'Não salvo',
  },
};

export function UroStatusBar({ status, message, timestamp, operador }: UroStatusBarProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`border-t border-slate-200 dark:border-white/[0.1] ${config.bg} px-4 py-3`}>
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={`w-3 h-3 rounded-full shrink-0 ${config.dot}`} />

        {/* Status label + message */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>
            {config.label}
          </p>
          {message && <p className={`text-xs mt-0.5 ${config.text} opacity-80`}>{message}</p>}
        </div>

        {/* Timestamp (right-aligned) */}
        {timestamp && (
          <div className="text-right shrink-0">
            <p className="text-xs font-mono text-slate-500 dark:text-white/40">{timestamp}</p>
            {operador && (
              <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">{operador}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
