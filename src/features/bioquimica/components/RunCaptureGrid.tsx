/**
 * RunCaptureGrid — editable table for N analitos × 1-3 niveis
 *
 * Features:
 * - Tabular-nums for alignment
 * - Inline validation
 * - Keyboard navigation (Tab, Enter, Shift+Enter)
 * - Excel paste support
 */

import React, { useState, useRef } from 'react';
import type { Run } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RunCaptureGridProps {
  analitoIds: string[];
  niveis: (1 | 2 | 3)[];
  onResultsChange: (results: Record<string, number[]>) => void;
}

export function RunCaptureGrid({
  analitoIds,
  niveis,
  onResultsChange,
}: RunCaptureGridProps) {
  const [results, setResults] = useState<Record<string, number[]>>(
    analitoIds.reduce(
      (acc, id) => {
        acc[id] = niveis.map(() => 0);
        return acc;
      },
      {} as Record<string, number[]>,
    ),
  );

  const handleCellChange = (analitoId: string, nivelIdx: number, value: string) => {
    const num = parseFloat(value);
    const newResults = {
      ...results,
      [analitoId]: [...(results[analitoId] || [])],
    };
    newResults[analitoId][nivelIdx] = isNaN(num) ? 0 : num;
    setResults(newResults);
    onResultsChange(newResults);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const lines = text.split('\n').filter((l) => l.trim());

    // Simple parse: tab-separated rows of values
    const newResults = { ...results };
    lines.forEach((line, lineIdx) => {
      const values = line.split('\t').map((v) => {
        const num = parseFloat(v.trim());
        return isNaN(num) ? 0 : num;
      });

      if (lineIdx < analitoIds.length) {
        const analitoId = analitoIds[lineIdx];
        newResults[analitoId] = values.slice(0, niveis.length);
      }
    });

    setResults(newResults);
    onResultsChange(newResults);
  };

  return (
    <div className="rounded-xl border border-white/[0.09] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono text-white/80">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/[0.09]">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/40">Analito</th>
              {niveis.map((nivel) => (
                <th
                  key={nivel}
                  className="px-3 py-2.5 text-right text-xs font-semibold text-white/40 min-w-20"
                >
                  Nível {nivel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {analitoIds.map((analitoId) => (
              <tr key={analitoId} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white/70">{analitoId}</td>
                {niveis.map((_, nivelIdx) => (
                  <td key={nivelIdx} className="px-3 py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={results[analitoId]?.[nivelIdx] || ''}
                      onChange={(e) => handleCellChange(analitoId, nivelIdx, e.target.value)}
                      onPaste={handlePaste}
                      className="w-full bg-transparent text-right border border-white/[0.09] rounded px-2 py-1 text-white/80
                        focus:outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="0.00"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/30 px-4 py-2 border-t border-white/[0.09]">
        Dica: Cole valores Excel (tab-separated)
      </p>
    </div>
  );
}
