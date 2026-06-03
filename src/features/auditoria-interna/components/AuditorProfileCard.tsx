import React from 'react';
import { Shield, AlertTriangle, Calendar, Award, CheckCircle2 } from 'lucide-react';
import type { AuditorQualification } from '../types/auditor';
import { validateQualification } from '../services/auditorQualificationService';

interface AuditorProfileCardProps {
  auditor: AuditorQualification;
  compact?: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ativo: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Ativo' },
  inativo: { bg: 'bg-white/10', text: 'text-white/50', label: 'Inativo' },
  vencido: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Vencido' },
  'em-formacao': { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Em Formação' },
};

export function AuditorProfileCard({ auditor, compact = false }: AuditorProfileCardProps) {
  const { valid, issues } = validateQualification(auditor);
  const statusStyle = STATUS_STYLES[auditor.status] || STATUS_STYLES.inativo;
  const validUntil = auditor.qualificacaoValidaAte?.toDate?.();

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white/60" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{auditor.nome}</p>
          <p className="text-xs text-white/50">{auditor.registroProfissional}</p>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          {statusStyle.label}
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white/60" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">{auditor.nome}</h3>
          <p className="text-sm text-white/50">{auditor.formacaoAcademica}</p>
          <p className="text-xs text-white/40">{auditor.registroProfissional}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-white/5">
          <p className="text-lg font-bold text-white">{auditor.totalAuditoriasRealizadas}</p>
          <p className="text-xs text-white/50">Auditorias</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/5">
          <p className="text-lg font-bold text-white">
            {auditor.certificacoes.filter((c) => c.status === 'vigente').length}
          </p>
          <p className="text-xs text-white/50">Certificações</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/5">
          <p className="text-lg font-bold text-white">
            {auditor.escoposAutorizados.filter((s) => s.autorizado).length}
          </p>
          <p className="text-xs text-white/50">Escopos</p>
        </div>
      </div>

      {/* Validity */}
      {validUntil && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-white/40" />
          <span className="text-white/60">Válido até: </span>
          <span className={valid ? 'text-emerald-400' : 'text-red-400'}>
            {validUntil.toLocaleDateString('pt-BR')}
          </span>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scopes */}
      <div className="flex flex-wrap gap-1.5">
        {auditor.escoposAutorizados.map((scope) => (
          <span
            key={scope.bloco}
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              scope.autorizado
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400 line-through'
            }`}
          >
            Bloco {scope.bloco}
          </span>
        ))}
      </div>
    </div>
  );
}
