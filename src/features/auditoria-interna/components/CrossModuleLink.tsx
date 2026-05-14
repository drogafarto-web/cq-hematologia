import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CrossModuleLinkProps {
  moduloOrigem: string;
  linkDireto: string;
  titulo?: string;
}

const MODULE_LABELS: Record<string, { label: string; color: string }> = {
  fornecedores: { label: 'Fornecedores', color: 'text-purple-400' },
  equipamentos: { label: 'Equipamentos', color: 'text-cyan-400' },
  calibracao: { label: 'Calibração', color: 'text-teal-400' },
  treinamentos: { label: 'Treinamentos', color: 'text-amber-400' },
  risks: { label: 'Gestão de Riscos', color: 'text-red-400' },
  'risk-management': { label: 'Gestão de Riscos', color: 'text-red-400' },
  'nao-conformidades': { label: 'Não Conformidades', color: 'text-orange-400' },
  'capa-tracking': { label: 'CAPA', color: 'text-pink-400' },
  sgq: { label: 'Documentos SGQ', color: 'text-blue-400' },
  sgd: { label: 'Governança', color: 'text-indigo-400' },
  personnel: { label: 'Pessoal', color: 'text-green-400' },
  'notivisa-portal': { label: 'Notivisa', color: 'text-yellow-400' },
  'controle-temperatura': { label: 'Temperatura', color: 'text-sky-400' },
  'ciq-imuno': { label: 'CIQ', color: 'text-violet-400' },
  biosseguranca: { label: 'Biossegurança', color: 'text-lime-400' },
  pgrss: { label: 'PGRSS', color: 'text-emerald-400' },
  lgpd: { label: 'LGPD', color: 'text-slate-400' },
  reclamacoes: { label: 'Reclamações', color: 'text-rose-400' },
  liberacao: { label: 'Liberação', color: 'text-fuchsia-400' },
  criticos: { label: 'Valores Críticos', color: 'text-red-300' },
  'lab-apoio': { label: 'Lab Apoio', color: 'text-blue-300' },
  'management-review': { label: 'Análise Crítica', color: 'text-amber-300' },
  'auditoria-interna': { label: 'Auditoria', color: 'text-cyan-300' },
};

export function CrossModuleLink({ moduloOrigem, linkDireto, titulo }: CrossModuleLinkProps) {
  const navigate = useNavigate();
  const moduleInfo = MODULE_LABELS[moduloOrigem] || { label: moduloOrigem, color: 'text-white/60' };

  return (
    <button
      type="button"
      onClick={() => navigate(linkDireto)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs group"
      aria-label={`Navegar para ${moduleInfo.label}`}
    >
      <span className={`font-medium ${moduleInfo.color}`}>
        {titulo || moduleInfo.label}
      </span>
      <ExternalLink className="w-3 h-3 text-white/40 group-hover:text-white/70 transition-colors" />
    </button>
  );
}
