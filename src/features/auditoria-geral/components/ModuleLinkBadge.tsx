import { useState } from 'react';

const MODULE_NAMES: Record<string, string> = {
  sgd: 'Gestao Documental',
  sgq: 'Qualidade',
  pops: 'POPs',
  equipamentos: 'Equipamentos',
  risks: 'Riscos',
  insumos: 'Insumos',
  treinamentos: 'Treinamentos',
  biosseguranca: 'Biosseguranca',
  pgrss: 'PGRSS',
  kpis: 'KPIs',
  lgpd: 'LGPD',
  ceq: 'CEQ',
  bioquimica: 'Bioquimica',
  turnos: 'Turnos',
  'controle-temperatura': 'Temperatura',
  'lab-apoio': 'Labs de Apoio',
  'educacao-continuada': 'Educacao Continuada',
  'auditoria-interna': 'Auditoria Interna',
  criticos: 'Criticos',
  coagulacao: 'Coagulacao',
  'ciq-imuno': 'CIQ Imuno',
  uroanalise: 'Uroanalise',
  fornecedores: 'Fornecedores',
  analyzer: 'Analyzer',
};

interface Props {
  moduloVinculado: string | null;
}

export function ModuleLinkBadge({ moduloVinculado }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!moduloVinculado) return null;

  const displayName = MODULE_NAMES[moduloVinculado] ?? moduloVinculado;

  return (
    <span
      className="relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-medium cursor-default select-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Modulo vinculado: ${displayName}`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0"
      >
        <path
          d="M6.5 11.5L4 14a2.12 2.12 0 01-3-3l2.5-2.5M9.5 4.5L12 2a2.12 2.12 0 013 3l-2.5 2.5M6 10l4-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {displayName}
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-[#1e1e22] border border-white/[0.12] text-[10px] text-white/80 whitespace-nowrap z-10 shadow-lg">
          Evidencia no modulo {displayName}
        </span>
      )}
    </span>
  );
}
