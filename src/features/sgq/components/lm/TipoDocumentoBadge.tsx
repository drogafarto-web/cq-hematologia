/**
 * TipoDocumentoBadge.tsx
 *
 * 15 document types with semantic dark-first colors.
 * MQ/PQ/IT/FR/POL + others with WCAG AA contrast.
 */

export type TipoDocumento =
  | 'MQ' | 'PQ' | 'IT' | 'FR' | 'POL'
  | 'ROP' | 'AP' | 'EP' | 'DOC' | 'REL'
  | 'CER' | 'AUD' | 'REC' | 'FORM' | 'OUT';

interface TipoDocumentoBadgeProps {
  tipo: TipoDocumento;
  className?: string;
  showLabel?: boolean;
  tooltip?: boolean;
}

const TIPO_CONFIG: Record<TipoDocumento, { label: string; colorClass: string; description: string }> = {
  'MQ': {
    label: 'MQ',
    colorClass: 'bg-yellow-700/90 text-yellow-100',
    description: 'Manual da Qualidade',
  },
  'PQ': {
    label: 'PQ',
    colorClass: 'bg-blue-700/90 text-blue-100',
    description: 'Procedimento de Qualidade',
  },
  'IT': {
    label: 'IT',
    colorClass: 'bg-emerald-700/90 text-emerald-100',
    description: 'Instrução Técnica',
  },
  'FR': {
    label: 'FR',
    colorClass: 'bg-orange-700/90 text-orange-100',
    description: 'Formulário/Registro',
  },
  'POL': {
    label: 'POL',
    colorClass: 'bg-purple-700/90 text-purple-100',
    description: 'Política',
  },
  'ROP': {
    label: 'ROP',
    colorClass: 'bg-indigo-700/90 text-indigo-100',
    description: 'Relatório Operacional',
  },
  'AP': {
    label: 'AP',
    colorClass: 'bg-rose-700/90 text-rose-100',
    description: 'Análise de Processo',
  },
  'EP': {
    label: 'EP',
    colorClass: 'bg-cyan-700/90 text-cyan-100',
    description: 'Evidência de Processo',
  },
  'DOC': {
    label: 'DOC',
    colorClass: 'bg-slate-700/90 text-slate-100',
    description: 'Documento Geral',
  },
  'REL': {
    label: 'REL',
    colorClass: 'bg-fuchsia-700/90 text-fuchsia-100',
    description: 'Relatório',
  },
  'CER': {
    label: 'CER',
    colorClass: 'bg-amber-700/90 text-amber-100',
    description: 'Certificado',
  },
  'AUD': {
    label: 'AUD',
    colorClass: 'bg-teal-700/90 text-teal-100',
    description: 'Auditoria',
  },
  'REC': {
    label: 'REC',
    colorClass: 'bg-lime-700/90 text-lime-100',
    description: 'Recomendação',
  },
  'FORM': {
    label: 'FORM',
    colorClass: 'bg-pink-700/90 text-pink-100',
    description: 'Formulário',
  },
  'OUT': {
    label: 'OUT',
    colorClass: 'bg-slate-600/90 text-slate-200',
    description: 'Outro',
  },
};

export function TipoDocumentoBadge({
  tipo,
  className = '',
  showLabel = true,
  tooltip = true,
}: TipoDocumentoBadgeProps) {
  const config = TIPO_CONFIG[tipo];

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
