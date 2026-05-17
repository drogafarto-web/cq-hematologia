/**
 * personnel/components/DossieTreinamentosSection.tsx
 *
 * Shows training history for a colaborador in the dossier tab.
 * Cross-module read from educacaoContinuada.
 */

import React from 'react';
import { useColaboradorTreinamentos } from '../hooks/useColaboradorTreinamentos';

interface DossieTreinamentosSectionProps {
  colaboradorId: string;
}

export function DossieTreinamentosSection({ colaboradorId }: DossieTreinamentosSectionProps): React.ReactElement {
  const { treinamentos, horasAno, loading, error } = useColaboradorTreinamentos(colaboradorId);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
        Erro ao carregar treinamentos: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with hours badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Treinamentos Realizados</h3>
        <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-violet-300">
          {horasAno}h no ano
        </span>
      </div>

      {treinamentos.length === 0 ? (
        <p className="text-xs text-white/40">Nenhum treinamento registrado para este colaborador.</p>
      ) : (
        <div className="space-y-2">
          {treinamentos.map((t, idx) => (
            <div
              key={`${t.titulo}-${idx}`}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/80">{t.titulo}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {t.dataRealizacao
                    ? t.dataRealizacao.toLocaleDateString('pt-BR')
                    : 'Data não registrada'}
                  {' — '}
                  {t.cargaHoraria}h
                </p>
              </div>
              <ResultadoBadge resultado={t.resultado} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: string }): React.ReactElement {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    aprovado: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Aprovado' },
    realizado: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Realizado' },
    reprovado: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Reprovado' },
    cancelado: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Cancelado' },
    adiado: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Adiado' },
  };

  const cfg = config[resultado] ?? { bg: 'bg-white/10', text: 'text-white/60', label: resultado };

  return (
    <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}
