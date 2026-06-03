/**
 * ReviewHistory.tsx
 *
 * Periodic review history for a single risk
 * Shows all revisões appended to risk.reviewHistory
 * Displays: Data, Revisor, Resultado, NPR mutation (if reclassificado), Observações
 */

import React, { memo } from 'react';
import type { Risk, Revisao } from '../types/Risk';

const RESULTADO_CONFIG: Record<string, { dot: string; cls: string }> = {
  mantido: {
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]',
  },
  reduzido: {
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  },
  reclassificado: {
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
  fechado: {
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]',
  },
};

const ReviewRow = memo(({ revisao }: { revisao: Revisao }) => {
  const date =
    revisao.criadoEm instanceof Date
      ? revisao.criadoEm
      : revisao.criadoEm && typeof revisao.criadoEm === 'object' && 'toDate' in revisao.criadoEm
        ? (revisao.criadoEm as any).toDate()
        : new Date(revisao.criadoEm);

  return (
    <tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150">
      <td className="px-4 py-3 text-xs text-white/60">
        {date.toLocaleDateString('pt-BR')}
        <div className="text-[10px] text-white/40">{date.toLocaleTimeString('pt-BR')}</div>
      </td>
      <td className="px-4 py-3 text-sm text-white/80">{revisao.revisorNome || revisao.revisor}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${RESULTADO_CONFIG[revisao.resultado]?.cls || ''}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${RESULTADO_CONFIG[revisao.resultado]?.dot || ''}`}
          />
          {revisao.resultado}
        </span>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-white/60">
        {revisao.resultado === 'reclassificado' && revisao.nprPrevio ? (
          <span className="text-amber-300">
            {revisao.nprPrevio} → {revisao.nprNovo}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-xs text-white/60 max-w-xs truncate">
        {revisao.observacoes || '—'}
      </td>
    </tr>
  );
});

ReviewRow.displayName = 'ReviewRow';

interface ReviewHistoryProps {
  risk: Risk;
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({ risk }) => {
  const reviews = [...risk.reviewHistory].reverse(); // Most recent first

  if (reviews.length === 0) {
    return <div className="py-8 text-center text-white/30 text-sm">Nenhuma revisão registrada</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-white/60">
        {reviews.length} revisão{reviews.length !== 1 ? 'ões' : ''} registrada
        {reviews.length !== 1 ? 's' : ''}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Revisor</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">NPR</th>
              <th className="px-4 py-3 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((rev, idx) => (
              <ReviewRow key={`${risk.id}-rev-${idx}`} revisao={rev} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      {risk.reviewHistory.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <div className="font-semibold text-white">{risk.reviewHistory.length}</div>
            <div className="text-white/50">Total de revisões</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <div className="font-semibold text-amber-300">
              {risk.reviewHistory.filter((r) => r.resultado === 'reclassificado').length}
            </div>
            <div className="text-white/50">Reclassificadas</div>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <div className="font-semibold text-white/70">
              {risk.reviewDate ? 'Próxima' : 'Não agendada'}
            </div>
            <div className="text-white/50">
              {risk.reviewDate
                ? risk.reviewDate instanceof Date
                  ? risk.reviewDate.toLocaleDateString('pt-BR')
                  : typeof risk.reviewDate === 'object' && 'toDate' in risk.reviewDate
                    ? (risk.reviewDate as any).toDate().toLocaleDateString('pt-BR')
                    : new Date(risk.reviewDate).toLocaleDateString('pt-BR')
                : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
