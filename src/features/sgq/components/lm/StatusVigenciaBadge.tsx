/**
 * StatusVigenciaBadge.tsx
 *
 * 4 document status states with semantic dark-first colors.
 * WCAG AA contrast ratios for all states.
 */

export type StatusVigencia = 'draft' | 'em-revisao' | 'vigente' | 'obsoleto';

interface StatusVigenciaBadgeProps {
  status: StatusVigencia;
  className?: string;
  showLabel?: boolean;
  tooltip?: boolean;
}

const STATUS_CONFIG: Record<StatusVigencia, { label: string; colorClass: string; description: string }> = {
  'draft': {
    label: 'Rascunho',
    colorClass: 'bg-slate-700/90 text-slate-100',
    description: 'Documento em elaboração, não distribuído',
  },
  'em-revisao': {
    label: 'Em Revisão',
    colorClass: 'bg-amber-700/90 text-amber-100',
    description: 'Aguardando aprovação de Responsável Técnico',
  },
  'vigente': {
    label: 'Vigente',
    colorClass: 'bg-emerald-700/90 text-emerald-100',
    description: 'Documento aprovado e em uso',
  },
  'obsoleto': {
    label: 'Obsoleto',
    colorClass: 'bg-red-700/90 text-red-100',
    description: 'Documento retirado de circulação',
  },
};

export function StatusVigenciaBadge({
  status,
  className = '',
  showLabel = true,
  tooltip = true,
}: StatusVigenciaBadgeProps) {
  const config = STATUS_CONFIG[status];

  const badge = (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold
        transition-colors duration-150 cursor-default
        ${config.colorClass}
        ${className}
      `}
      role="status"
      aria-label={config.description}
    >
      {showLabel ? config.label : null}
    </span>
  );

  if (!tooltip) return badge;

  return (
    <div
      className="group relative inline-block"
      title={config.description}
    >
      {badge}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-[#141417] text-white text-xs rounded px-2 py-1 whitespace-nowrap border border-white/10 shadow-lg">
          {config.description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141417]" />
        </div>
      </div>
    </div>
  );
}
