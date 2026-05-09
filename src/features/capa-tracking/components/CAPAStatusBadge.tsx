/**
 * CAPAStatusBadge.tsx
 *
 * Color-coded status pill component (5 workflow states).
 * Dark-first design with proper contrast ratios (WCAG AA).
 */

import type { CapaStateLegacy } from '../types';

interface CAPAStatusBadgeProps {
  status: CapaStateLegacy;
  className?: string;
}

/**
 * Mapa de status → label + cor.
 * Seguindo convenção de cores:
 * - aberto: slate (generic/inactive)
 * - em-andamento: blue (active work)
 * - evidencia-submetida: indigo (awaiting review)
 * - auditor-revisando: amber (in review)
 * - fechado: emerald (complete)
 */
const STATUS_CONFIG: Record<CapaStateLegacy, { label: string; colorClass: string }> = {
  'aberto': {
    label: 'Aberto',
    colorClass: 'bg-slate-700 text-slate-100',
  },
  'em-andamento': {
    label: 'Em Andamento',
    colorClass: 'bg-blue-700 text-blue-100',
  },
  'evidencia-submetida': {
    label: 'Evidência Submetida',
    colorClass: 'bg-indigo-700 text-indigo-100',
  },
  'auditor-revisando': {
    label: 'Auditor Revisando',
    colorClass: 'bg-amber-700 text-amber-100',
  },
  'fechado': {
    label: 'Fechado',
    colorClass: 'bg-emerald-700 text-emerald-100',
  },
};

export function CAPAStatusBadge({
  status,
  className = '',
}: CAPAStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
        transition-colors duration-150
        ${config.colorClass}
        ${className}
      `}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
