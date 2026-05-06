/**
 * CAPADeadlineIndicator.tsx
 *
 * Visual deadline indicator with days remaining.
 * Uses tabular-nums for alignment of numbers.
 * Color-coded dot: emerald (on-track), amber (at-risk), red (overdue).
 */

import type { DeadlineStatus } from '../types';

interface CAPADeadlineIndicatorProps {
  deadline: Date | { toDate(): Date };
  deadlineStatus: DeadlineStatus;
  className?: string;
}

/**
 * Formata data para exibição.
 */
function formatDeadlineDate(deadline: Date | { toDate(): Date }): string {
  const date = deadline instanceof Date ? deadline : deadline.toDate();
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Cores do indicador visual.
 */
const STATUS_COLOR: Record<DeadlineStatus['status'], string> = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-amber-500',
  'overdue': 'bg-red-500',
};

/**
 * Labels para o status.
 */
const STATUS_LABEL: Record<DeadlineStatus['status'], string> = {
  'on-track': 'No Prazo',
  'at-risk': 'Risco',
  'overdue': 'Vencido',
};

export function CAPADeadlineIndicator({
  deadline,
  deadlineStatus,
  className = '',
}: CAPADeadlineIndicatorProps) {
  const formattedDate = formatDeadlineDate(deadline);
  const dotColor = STATUS_COLOR[deadlineStatus.status];
  const label = STATUS_LABEL[deadlineStatus.status];

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="region"
      aria-label={`Deadline: ${formattedDate}, ${label}, ${Math.abs(deadlineStatus.daysRemaining)} dias`}
    >
      {/* Indicator dot */}
      <div
        className={`h-2 w-2 rounded-full ${dotColor} flex-shrink-0`}
        aria-hidden="true"
      />

      {/* Days remaining with tabular-nums for alignment */}
      <span className="font-mono font-semibold text-sm tabular-nums">
        {Math.abs(deadlineStatus.daysRemaining)}d
      </span>

      {/* Status label */}
      <span className="text-xs text-white/70">{label}</span>

      {/* Date */}
      <span className="text-xs text-white/60 ml-auto">{formattedDate}</span>
    </div>
  );
}
