/**
 * RiskMatrix.tsx
 *
 * 5×5 FMEA Risk Matrix
 * Rows: Probabilidade (1-5), Columns: Severidade (1-5)
 * Each cell colored by risk nivel (NPR zone)
 * Shows count of risks in each zone + drill-down capability
 */

import React, { useMemo } from 'react';
import type { Risk } from '../types/Risk';

interface RiskMatrixProps {
  risks: Risk[];
  onCellClick?: (p: number, s: number) => void;
}

const NIVEL_COLORS = {
  baixo: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  medio: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  alto: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
  critico: 'bg-red-500/10 border-red-500/20 text-red-300',
};

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ risks, onCellClick }) => {
  const matrix = useMemo(() => {
    const grid: Record<string, Risk[]> = {};
    for (let p = 1; p <= 5; p++) {
      for (let s = 1; s <= 5; s++) {
        grid[`${p}-${s}`] = [];
      }
    }
    risks
      .filter(r => !r.deletadoEm)
      .forEach(r => {
        const key = `${r.probabilidade}-${r.severidade}`;
        if (grid[key]) grid[key].push(r);
      });
    return grid;
  }, [risks]);

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-white/60">
        Matriz 5×5 de Probabilidade × Severidade
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {Object.entries(NIVEL_COLORS).map(([nivel, cls]) => (
          <div key={nivel} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${cls}`} />
            <span className="text-white/60 capitalize">{nivel}</span>
          </div>
        ))}
      </div>

      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block border border-white/[0.06]">
          {/* Header row (Severidade) */}
          <div className="flex">
            <div className="w-12 h-12 border-r border-b border-white/[0.06] bg-white/[0.02]" />
            {[1, 2, 3, 4, 5].map(s => (
              <div
                key={`header-${s}`}
                className="w-20 h-12 border-r border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-xs font-medium text-white/60"
              >
                S={s}
              </div>
            ))}
          </div>

          {/* Rows (Probabilidade) */}
          {[5, 4, 3, 2, 1].map(p => (
            <div key={`row-${p}`} className="flex">
              <div className="w-12 h-12 border-r border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-xs font-medium text-white/60">
                P={p}
              </div>
              {[1, 2, 3, 4, 5].map(s => {
                const key = `${p}-${s}`;
                const cellRisks = matrix[key] || [];
                const npr = p * s;
                let nivel: 'baixo' | 'medio' | 'alto' | 'critico';
                if (npr <= 24) nivel = 'baixo';
                else if (npr <= 60) nivel = 'medio';
                else if (npr <= 99) nivel = 'alto';
                else nivel = 'critico';

                return (
                  <div
                    key={key}
                    onClick={() => onCellClick?.(p, s)}
                    className={`w-20 h-12 border-r border-b border-white/[0.06] flex flex-col items-center justify-center cursor-pointer transition-all hover:ring-2 hover:ring-white/[0.2] ${NIVEL_COLORS[nivel]}`}
                  >
                    {cellRisks.length > 0 && (
                      <>
                        <div className="text-xs font-bold">{cellRisks.length}</div>
                        <div className="text-[10px] text-white/40">NPR={npr}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {['baixo', 'medio', 'alto', 'critico'].map(nivel => {
          const count = risks.filter(r => !r.deletadoEm && r.nivel === nivel).length;
          return (
            <div key={nivel} className={`p-3 rounded-lg border ${NIVEL_COLORS[nivel as keyof typeof NIVEL_COLORS]}`}>
              <div className="font-semibold">{count}</div>
              <div className="text-white/50 capitalize">{nivel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
