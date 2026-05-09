import React, { useEffect, useState, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeRisks } from '../../../features/risks/services/risksService';

/**
 * RiskMatrixHeatmap — 5×5 NPR heatmap visualization (Phase 8 Wave 5)
 *
 * Displays:
 * - 5×5 grid: X = Probability (1-5), Y = Severity (1-5)
 * - Color by average NPR of risks in each cell
 * - Cell counts + hover tooltips
 * - Top 5 risks list (sorted by NPR descending)
 * - "View all risks" link to full risks module
 *
 * Colors:
 * - NPR < 25: emerald (low)
 * - 25 ≤ NPR < 50: amber (medium)
 * - NPR ≥ 50: red (high)
 *
 * No external chart library — CSS grid + Tailwind only
 */

interface RiskData {
  id: string;
  description: string;
  probability: number; // 1-5
  severity: number; // 1-5
  detectability?: number; // 1-5, default 3
  controls: string;
}

interface CellData {
  risks: RiskData[];
  avgNpr: number;
}

export default function RiskMatrixHeatmap() {
  const labId = useActiveLabId();

  const [risks, setRisks] = useState<RiskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  // Subscribe to risks via real-time listener
  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeRisks(
      labId,
      {},
      (riskList: any[]) => {
        const mapped: RiskData[] = riskList.map((r: any) => ({
          id: r.id,
          description: r.titulo,
          probability: r.probabilidade ?? 1,
          severity: r.severidade ?? 1,
          detectability: r.detectabilidade ?? 3,
          controls: r.controlesExistentes ?? '',
        }));
        setRisks(mapped);
        setError(null);
        setLoading(false);
      },
      (err: Error) => {
        console.error('❌ RiskMatrixHeatmap: subscribe failed', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar riscos');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId]);

  // Compute matrix: 5×5 grid of cells
  const matrix = useMemo(() => {
    const cells: Record<string, CellData> = {};

    for (let p = 1; p <= 5; p++) {
      for (let s = 1; s <= 5; s++) {
        cells[`${p}-${s}`] = { risks: [], avgNpr: 0 };
      }
    }

    // Populate cells
    risks.forEach((risk) => {
      const d = risk.detectability ?? 3;
      const npr = risk.probability * risk.severity * d;
      const key = `${risk.probability}-${risk.severity}`;

      if (cells[key]) {
        cells[key].risks.push(risk);
      }
    });

    // Compute average NPR per cell
    Object.values(cells).forEach((cell) => {
      if (cell.risks.length > 0) {
        const sum = cell.risks.reduce((acc, r) => {
          const d = r.detectability ?? 3;
          return acc + r.probability * r.severity * d;
        }, 0);
        cell.avgNpr = sum / cell.risks.length;
      }
    });

    return cells;
  }, [risks]);

  // Top 5 risks by NPR
  const topRisks = useMemo(() => {
    const withNpr = risks.map((r) => ({
      ...r,
      npr: r.probability * r.severity * (r.detectability ?? 3),
    }));
    return withNpr.sort((a, b) => b.npr - a.npr).slice(0, 5);
  }, [risks]);

  const getCellColor = (npr: number): string => {
    if (npr < 25) return 'bg-emerald-500/20 border-emerald-500/40';
    if (npr < 50) return 'bg-amber-500/20 border-amber-500/40';
    return 'bg-red-500/20 border-red-500/40';
  };

  const getCellTextColor = (npr: number): string => {
    if (npr < 25) return 'text-emerald-600 dark:text-emerald-400';
    if (npr < 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 dark:bg-white/[0.1] rounded w-40" />
          <div className="h-80 bg-slate-200 dark:bg-white/[0.1] rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/[0.06] border border-red-200 dark:border-red-500/20 rounded-xl p-6">
        <p className="text-red-700 dark:text-red-400 text-sm">
          Erro ao carregar matriz de riscos: {error}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          Matriz de Riscos (NPR)
        </h3>
        <p className="text-sm text-slate-600 dark:text-white/40">
          Visualização 5×5: Probabilidade × Severidade
        </p>
      </div>

      {/* Matrix */}
      {risks.length > 0 ? (
        <div className="space-y-4">
          {/* Grid */}
          <div className="border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden">
            <div className="bg-slate-50 dark:bg-white/[0.02] grid" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
              {/* Header row */}
              <div className="p-3 border-r border-b border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-white/40 text-center" />
              {[1, 2, 3, 4, 5].map((p) => (
                <div
                  key={`col-${p}`}
                  className="p-3 border-r border-b border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-white/40 text-center"
                >
                  P={p}
                </div>
              ))}

              {/* Rows */}
              {[5, 4, 3, 2, 1].map((severity) => (
                <React.Fragment key={`row-${severity}`}>
                  {/* Row header */}
                  <div className="p-3 border-r border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-600 dark:text-white/40 text-center">
                    S={severity}
                  </div>

                  {/* Cells */}
                  {[1, 2, 3, 4, 5].map((prob) => {
                    const key = `${prob}-${severity}`;
                    const cell = matrix[key];
                    const isHovered = hoveredCell && hoveredCell[0] === prob && hoveredCell[1] === severity;

                    return (
                      <div
                        key={key}
                        className={`min-h-24 p-3 border-r border-slate-200 dark:border-white/[0.08] flex flex-col items-center justify-center cursor-pointer transition-all ${getCellColor(cell.avgNpr)} border-2 ${
                          isHovered ? 'ring-2 ring-violet-400' : ''
                        }`}
                        onMouseEnter={() => setHoveredCell([prob, severity])}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <p className={`text-2xl font-bold ${getCellTextColor(cell.avgNpr)}`}>
                          {cell.risks.length}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-white/30 mt-1">
                          NPR {Math.round(cell.avgNpr)}
                        </p>
                        {isHovered && cell.risks.length > 0 && (
                          <div className="absolute z-10 mt-2 bg-slate-900 dark:bg-black text-white text-xs p-2 rounded shadow-lg max-w-xs">
                            {cell.risks.slice(0, 3).map((r) => (
                              <div key={r.id} className="truncate">
                                • {r.description}
                              </div>
                            ))}
                            {cell.risks.length > 3 && (
                              <div className="text-white/50 mt-1">
                                +{cell.risks.length - 3} mais
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Top 5 risks */}
          {topRisks.length > 0 && (
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Top 5 Riscos
              </p>
              {topRisks.map((risk, idx) => (
                <div
                  key={risk.id}
                  className="flex items-start justify-between p-3 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {idx + 1}. {risk.description}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-white/40 mt-0.5">
                      Controles: {risk.controls}
                    </p>
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {Math.round(risk.probability * risk.severity * (risk.detectability ?? 3))}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-white/30">NPR</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View all link */}
          <div className="text-center pt-2">
            <a
              href="#/risks"
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              Ver todos os riscos →
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-white/40 text-center py-8">
          Nenhum risco registrado
        </p>
      )}
    </div>
  );
}
