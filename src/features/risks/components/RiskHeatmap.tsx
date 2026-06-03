/**
 * RiskHeatmap — Enterprise 5×5 heatmap (Probabilidade × Severidade).
 * Inspired by Datadog/Grafana risk matrices.
 */

import React, { useMemo, useState, useCallback } from 'react';

import type { Probabilidade, Risk, Severidade } from '../types/Risk';

const S_AXIS: Severidade[] = [1, 2, 3, 4, 5];
const P_AXIS: Probabilidade[] = [5, 4, 3, 2, 1];

const S_LABELS: Record<number, string> = {
  1: 'Insignificante',
  2: 'Menor',
  3: 'Moderada',
  4: 'Maior',
  5: 'Catastrófica',
};
const P_LABELS: Record<number, string> = {
  1: 'Rara',
  2: 'Improvável',
  3: 'Possível',
  4: 'Provável',
  5: 'Quase certa',
};

export interface RiskHeatmapProps {
  readonly risks: Risk[];
  readonly onCellClick?: (risks: Risk[]) => void;
}

function zoneColor(
  p: number,
  s: number,
): { bg: string; border: string; text: string; glow: string } {
  const score = p * s;
  if (score <= 4)
    return {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
      text: 'text-emerald-200',
      glow: '',
    };
  if (score <= 9)
    return { bg: 'bg-lime-500/15', border: 'border-lime-500/30', text: 'text-lime-200', glow: '' };
  if (score <= 12)
    return {
      bg: 'bg-yellow-500/15',
      border: 'border-yellow-500/30',
      text: 'text-yellow-200',
      glow: '',
    };
  if (score <= 16)
    return {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/40',
      text: 'text-orange-200',
      glow: 'shadow-orange-500/10 shadow-sm',
    };
  return {
    bg: 'bg-red-500/25',
    border: 'border-red-500/50',
    text: 'text-red-100',
    glow: 'shadow-red-500/20 shadow-md',
  };
}

function zoneLabel(p: number, s: number): string {
  const score = p * s;
  if (score <= 4) return 'Aceitável';
  if (score <= 9) return 'Tolerável';
  if (score <= 12) return 'Moderado';
  if (score <= 16) return 'Substancial';
  return 'Intolerável';
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ risks, onCellClick }) => {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { byCell, totalActive } = useMemo(() => {
    const active = risks.filter((r) => !r.deletadoEm);
    const map = new Map<string, Risk[]>();
    for (const r of active) {
      const key = `${r.probabilidade}-${r.severidade}`;
      const prev = map.get(key) ?? [];
      prev.push(r);
      map.set(key, prev);
    }
    return { byCell: map, totalActive: active.length };
  }, [risks]);

  const handleCellClick = useCallback(
    (p: number, s: number) => {
      const key = `${p}-${s}`;
      const cellRisks = byCell.get(key) ?? [];
      if (cellRisks.length > 0 && onCellClick) {
        onCellClick(cellRisks);
      }
    },
    [byCell, onCellClick],
  );

  const hoveredRisks = useMemo(() => {
    if (!hoveredCell) return null;
    return byCell.get(hoveredCell) ?? [];
  }, [hoveredCell, byCell]);

  return (
    <section
      className="rounded-xl border border-white/10 bg-[#0d0d10] p-5"
      aria-labelledby="risk-heatmap-title"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 id="risk-heatmap-title" className="text-sm font-semibold text-white">
            Matriz de Riscos
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            Probabilidade × Severidade — {totalActive} riscos ativos
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {[
            { label: 'Aceitável', cls: 'bg-emerald-500/40' },
            { label: 'Tolerável', cls: 'bg-lime-500/40' },
            { label: 'Moderado', cls: 'bg-yellow-500/40' },
            { label: 'Substancial', cls: 'bg-orange-500/50' },
            { label: 'Intolerável', cls: 'bg-red-500/50' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
              <span className="text-white/50 hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Y-axis label */}
        <div className="flex items-center">
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest -rotate-90 whitespace-nowrap">
            Probabilidade
          </span>
        </div>

        <div className="flex-1">
          {/* Grid */}
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: '5.5rem repeat(5, minmax(0, 1fr))' }}
            role="grid"
            aria-label="Mapa de riscos probabilidade por severidade"
          >
            {/* Header row */}
            <div />
            {S_AXIS.map((s) => (
              <div
                key={`h-${s}`}
                className="flex flex-col items-center justify-end pb-1.5 text-center"
                role="columnheader"
              >
                <span className="text-[10px] font-medium text-white/60">{s}</span>
                <span className="text-[9px] text-white/30 hidden md:block">{S_LABELS[s]}</span>
              </div>
            ))}

            {/* Rows */}
            {P_AXIS.map((p) => (
              <React.Fragment key={`row-${p}`}>
                <div className="flex items-center justify-end pr-2 gap-1" role="rowheader">
                  <span className="text-[9px] text-white/30 hidden md:block text-right">
                    {P_LABELS[p]}
                  </span>
                  <span className="text-[10px] font-medium text-white/60 w-3 text-right">{p}</span>
                </div>
                {S_AXIS.map((s) => {
                  const key = `${p}-${s}`;
                  const cellRisks = byCell.get(key) ?? [];
                  const count = cellRisks.length;
                  const zone = zoneColor(p, s);
                  const isHovered = hoveredCell === key;

                  return (
                    <div
                      key={key}
                      role="gridcell"
                      aria-label={`P${p} S${s}: ${count} riscos, zona ${zoneLabel(p, s)}`}
                      onMouseEnter={() => setHoveredCell(key)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => handleCellClick(p, s)}
                      className={`
                        relative flex min-h-[3.5rem] flex-col items-center justify-center rounded-lg
                        border transition-all duration-200 cursor-pointer
                        ${zone.bg} ${zone.border} ${zone.text} ${zone.glow}
                        ${isHovered ? 'scale-105 ring-2 ring-white/20 z-10' : ''}
                        ${count > 0 ? 'hover:scale-105' : 'opacity-60 hover:opacity-80'}
                      `}
                    >
                      {count > 0 ? (
                        <>
                          <span className="text-lg font-bold tabular-nums">{count}</span>
                          <span className="text-[9px] opacity-60 font-medium">
                            {count === 1 ? 'risco' : 'riscos'}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] opacity-40">—</span>
                      )}
                      {count > 0 && (
                        <div
                          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                            p * s > 16
                              ? 'bg-red-400 animate-pulse'
                              : p * s > 12
                                ? 'bg-orange-400'
                                : 'bg-transparent'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center mt-2">
            <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">
              Severidade
            </span>
          </div>
        </div>
      </div>

      {/* Hover tooltip panel */}
      {hoveredRisks && hoveredRisks.length > 0 && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 animate-in fade-in duration-150">
          <div className="text-[11px] font-medium text-white/60 mb-2">
            {hoveredRisks.length} risco(s) nesta célula
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {hoveredRisks.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-white/50 shrink-0">{r.codigo}</span>
                <span className="text-white/80 truncate">{r.descricao}</span>
                <span className="ml-auto shrink-0 tabular-nums font-semibold text-white/60">
                  NPR {r.npr}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
