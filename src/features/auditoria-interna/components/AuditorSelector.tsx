import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Star } from 'lucide-react';
import type { AuditorQualification } from '../types/auditor';
import { useAuditorQualification } from '../hooks/useAuditorQualification';
import { AuditorProfileCard } from './AuditorProfileCard';

interface AuditorSelectorProps {
  labId: string;
  blocoAuditado: string;
  onSelect: (auditors: string[], liderId: string) => void;
}

export function AuditorSelector({ labId, blocoAuditado, onSelect }: AuditorSelectorProps) {
  const { auditores, qualifiedAuditors, loading, getImpediment, getValidation } =
    useAuditorQualification(labId);
  const [selected, setSelected] = useState<string[]>([]);
  const [liderId, setLiderId] = useState<string>('');

  const auditorList = useMemo(() => {
    return auditores.map((a) => ({
      ...a,
      impediment: getImpediment(a.id, blocoAuditado),
      validation: getValidation(a.id),
    }));
  }, [auditores, blocoAuditado, getImpediment, getValidation]);

  const handleToggle = (auditorId: string) => {
    setSelected((prev) => {
      const next = prev.includes(auditorId)
        ? prev.filter((id) => id !== auditorId)
        : [...prev, auditorId];
      if (!next.includes(liderId)) setLiderId(next[0] || '');
      onSelect(next, next.includes(liderId) ? liderId : next[0] || '');
      return next;
    });
  };

  const handleSetLider = (auditorId: string) => {
    setLiderId(auditorId);
    onSelect(selected, auditorId);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-16 bg-white/5 rounded-lg" />
        ))}
      </div>
    );
  }

  if (auditores.length === 0) {
    return (
      <div className="text-center py-8 text-white/50">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum auditor qualificado cadastrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white/70">Selecionar Equipe Auditora</h4>
        <span className="text-xs text-white/40">{selected.length} selecionado(s)</span>
      </div>

      <div className="space-y-2">
        {auditorList.map(({ impediment, validation, ...auditor }) => {
          const isSelected = selected.includes(auditor.id);
          const isLider = liderId === auditor.id;
          const isBlocked = !!impediment || !validation.valid;

          return (
            <div
              key={auditor.id}
              className={`relative p-3 rounded-lg border transition-all ${
                isBlocked
                  ? 'bg-white/3 border-white/5 opacity-60'
                  : isSelected
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <button
                  type="button"
                  disabled={isBlocked}
                  onClick={() => handleToggle(auditor.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-white/30 hover:border-white/50'
                  } ${isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-label={`Selecionar ${auditor.nome}`}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{auditor.nome}</p>
                  <p className="text-xs text-white/50">
                    {auditor.registroProfissional} · {auditor.totalAuditoriasRealizadas} auditorias
                  </p>
                </div>

                {/* Líder badge */}
                {isSelected && (
                  <button
                    type="button"
                    onClick={() => handleSetLider(auditor.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isLider
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-white/40 hover:text-white/60'
                    }`}
                    aria-label={`Definir ${auditor.nome} como auditor líder`}
                  >
                    <Star className="w-3 h-3" />
                    {isLider ? 'Líder' : 'Definir líder'}
                  </button>
                )}
              </div>

              {/* Impediment warning */}
              {impediment && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Impedimento: {impediment.motivo}</span>
                </div>
              )}

              {/* Validation issues */}
              {!validation.valid && !impediment && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{validation.issues[0]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
