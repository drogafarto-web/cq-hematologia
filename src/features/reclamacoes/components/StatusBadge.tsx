import React from 'react';
import { getStatusColor, getStatusLabel, type ReclamacaoStatus } from '../utils/stateMachine';

interface StatusBadgeProps {
  status: ReclamacaoStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClasses[size]} ${color}`}
    >
      {label}
    </span>
  );
};
