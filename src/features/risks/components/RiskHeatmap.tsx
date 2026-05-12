/**
 * RiskHeatmap — grid 5×5 Probabilidade × Severidade com contagem e zona por NPR máximo na célula.
 */

import React, { useMemo } from 'react';

import type { Probabilidade, Risk, Severidade } from '../types/Risk';

const S_AXIS: Severidade[] = [1, 2, 3, 4, 5];
/** Linhas de cima (P=5) para baixo (P=1) — risco visual cresce para baixo-direita. */
const P_AXIS: Probabilidade[] = [5, 4, 3, 2, 1];

export interface RiskHeatmapProps {
  readonly risks: Risk[];
}

function cellClasses(maxNpr: number, count: number): string {
  if (count === 0) {
    return 'border border-white/10 bg-white/[0.04] text-white/35';
  }
  if (maxNpr <= 10) {
    return 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-100';
  }
  if (maxNpr <= 30) {
    return 'border border-yellow-500/35 bg-yellow-500/15 text-yellow-100';
  }
  if (maxNpr <= 60) {
    return 'border border-orange-500/40 bg-orange-500/20 text-orange-100';
  }
  return 'border border-red-500/45 bg-red-500/25 text-red-100';
}

function buildTooltip(p: Probabilidade, s: Severidade, cellRisks: Risk[]): string {
  if (cellRisks.length === 0) {
    return `P${p} × S${s} — sem riscos`;
  }
  const lines = cellRisks.map((r) => {
    const line = `${r.codigo}: ${r.descricao}`;
    return line.length > 120 ? `${line.slice(0, 117)}...` : line;
  });
  const head = `P${p} × S${s} — ${cellRisks.length} risco(s)\n`;
  return head + lines.join('\n');
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ risks }) => {
  const byCell = useMemo(() => {
    const active = risks.filter((r) => !r.deletadoEm);
    const map = new Map<string, Risk[]>();
    for (const r of active) {
      const key = `${r.probabilidade}-${r.severidade}`;
      const prev = map.get(key) ?? [];
      prev.push(r);
      map.set(key, prev);
    }
    return map;
  }, [risks]);

  return (
    <section className="rounded-xl border border-white/10 bg-[#141417] p-4" aria-labelledby="risk-heatmap-title">
      <h3 id="risk-heatmap-title" className="mb-3 text-sm font-medium text-white">
        Mapa de calor P × S
      </h3>
      <p className="mb-3 text-xs text-white/50">
        Eixo X = severidade (1–5), eixo Y = probabilidade (5 no topo → 1 na base). Cor pela maior NPR na célula.
      </p>
      <div
        className="grid gap-1 text-[11px] leading-tight tabular-nums"
        style={{ gridTemplateColumns: '2.5rem repeat(5, minmax(0, 1fr))' }}
        role="grid"
        aria-label="Mapa de riscos probabilidade por severidade"
      >
        <div />
        {S_AXIS.map((s) => (
          <div
            key={`h-${s}`}
            className="flex items-end justify-center pb-1 text-center text-white/50"
            role="columnheader"
          >
            S{s}
          </div>
        ))}
        {P_AXIS.map((p) => (
          <React.Fragment key={`row-${p}`}>
            <div
              className="flex items-center justify-end pr-1 text-white/50"
              role="rowheader"
            >
              P{p}
            </div>
            {S_AXIS.map((s) => {
              const key = `${p}-${s}`;
              const cellRisks = byCell.get(key) ?? [];
              const count = cellRisks.length;
              const maxNpr =
                count === 0 ? 0 : Math.max(...cellRisks.map((r) => r.npr));
              const title = buildTooltip(p, s, cellRisks);
              return (
                <div
                  key={key}
                  role="gridcell"
                  title={title}
                  className={`flex min-h-[2.75rem] flex-col items-center justify-center rounded-md px-1 py-1.5 text-center transition-colors duration-150 ${cellClasses(
                    maxNpr,
                    count,
                  )}`}
                >
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};
