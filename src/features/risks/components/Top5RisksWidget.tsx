/**
 * Top5RisksWidget.tsx
 *
 * Top 5 highest-risk items by NPR score
 * Ordered list view with risk cards showing:
 * - Rank (1-5)
 * - Código + Descrição
 * - NPR score (highlighted)
 * - Nivel badge
 * - Status
 */

import React, { useMemo } from 'react';
import type { Risk } from '../types/Risk';

const NIVEL_CONFIG: Record<string, { dot: string; cls: string }> = {
  baixo: {
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]',
  },
  medio: {
    dot: 'bg-amber-500',
    cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  },
  alto: {
    dot: 'bg-orange-500',
    cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
  },
  critico: {
    dot: 'bg-red-500',
    cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  },
};

interface Top5RisksWidgetProps {
  risks: Risk[];
  onRiskClick?: (risk: Risk) => void;
}

export const Top5RisksWidget: React.FC<Top5RisksWidgetProps> = ({ risks, onRiskClick }) => {
  const top5 = useMemo(() => {
    return risks
      .filter((r) => !r.deletadoEm)
      .sort((a, b) => b.npr - a.npr)
      .slice(0, 5);
  }, [risks]);

  if (top5.length === 0) {
    return <div className="p-8 text-center text-white/30 text-sm">Nenhum risco cadastrado</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {top5.map((risk, idx) => (
        <div
          key={risk.id}
          onClick={() => onRiskClick?.(risk)}
          className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-4">
            {/* Rank circle */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300">
              {idx + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-mono text-white/60">{risk.codigo}</p>
                  <p className="text-sm font-medium text-white/90 truncate">{risk.descricao}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-2xl font-bold tabular-nums text-red-400">{risk.npr}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">NPR</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${NIVEL_CONFIG[risk.nivel]?.cls || ''}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${NIVEL_CONFIG[risk.nivel]?.dot || ''}`}
                  />
                  {risk.nivel}
                </span>
                <span className="text-xs bg-white/[0.04] border border-white/[0.08] text-white/60 px-2 py-0.5 rounded-full">
                  {risk.processo}
                </span>
                <span className="text-xs bg-white/[0.04] border border-white/[0.08] text-white/60 px-2 py-0.5 rounded-full">
                  {risk.status}
                </span>
              </div>

              {/* FMEA scores */}
              <div className="flex gap-3 mt-3 text-xs text-white/50">
                <span>P={risk.probabilidade}</span>
                <span>S={risk.severidade}</span>
                <span>D={risk.deteccao}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
