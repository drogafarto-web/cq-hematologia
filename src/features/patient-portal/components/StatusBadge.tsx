import React from 'react';

type LaudoStatus = 'FINALIZADO' | 'PENDENTE' | 'CANCELADO' | 'EM_ANALISE';

interface StatusBadgeProps {
  status: LaudoStatus;
  criticoFlag?: boolean;
  className?: string;
}

/**
 * StatusBadge — Reusable status indicator for laudo
 *
 * Dark-first design with color tokens
 * Shows status + critical indicator if present
 *
 * Usage:
 *   <StatusBadge status="FINALIZADO" />
 *   <StatusBadge status="PENDENTE" criticoFlag={true} />
 */

const STATUS_CONFIG: Record<
  LaudoStatus,
  {
    label: string;
    icon: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  FINALIZADO: {
    label: 'Pronto',
    icon: '✓',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
  },
  PENDENTE: {
    label: 'Pendente',
    icon: '⏱',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-500/30',
  },
  EM_ANALISE: {
    label: 'Em análise',
    icon: '⧖',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-500/30',
  },
  CANCELADO: {
    label: 'Cancelado',
    icon: '×',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-300',
    borderColor: 'border-red-500/30',
  },
};

export const StatusBadge = React.memo(function StatusBadge({
  status,
  criticoFlag = false,
  className = '',
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          border text-xs font-medium transition-colors
          ${config.bgColor} ${config.textColor} ${config.borderColor}
        `}
        role="status"
        aria-label={config.label}
      >
        <span className="text-sm">{config.icon}</span>
        <span>{config.label}</span>
      </div>

      {criticoFlag && status === 'FINALIZADO' && (
        <div
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg
            bg-red-500/10 border border-red-500/30 text-xs font-medium text-red-300"
          role="status"
          aria-label="Resultado crítico"
        >
          <span>⚠</span>
          <span>Crítico</span>
        </div>
      )}
    </div>
  );
});
