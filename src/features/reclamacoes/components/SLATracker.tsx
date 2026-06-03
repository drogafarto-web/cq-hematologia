import React, { useMemo } from 'react';

interface SLATrackerProps {
  slaPrazo: Date | string;
}

export const SLATracker: React.FC<SLATrackerProps> = ({ slaPrazo }) => {
  const info = useMemo(() => {
    const deadline = typeof slaPrazo === 'string' ? new Date(slaPrazo) : slaPrazo;
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const isOverdue = diasRestantes < 0;

    let colorClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    let label = `${diasRestantes} dias`;

    if (isOverdue) {
      colorClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      label = `Atrasado ${Math.abs(diasRestantes)} dias`;
    } else if (diasRestantes <= 7) {
      colorClass = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      label = `${diasRestantes} dias restantes`;
    }

    return { label, colorClass, diasRestantes };
  }, [slaPrazo]);

  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full ${info.colorClass}`}
    >
      <svg
        className="w-4 h-4 mr-1.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {info.label}
    </div>
  );
};
