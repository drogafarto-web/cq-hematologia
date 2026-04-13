import React, { useState } from 'react';
import { ANALYTE_MAP } from '../../constants';
import type { Run, WestgardViolation } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M12 3.5l-.8 8a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  Aprovada:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  Rejeitada: 'bg-red-500/15     text-red-400     border-red-500/20',
  Pendente:  'bg-amber-500/15   text-amber-400   border-amber-500/20',
};

function StatusBadge({ status }: { status: Run['status'] }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ─── Westgard violation chip ──────────────────────────────────────────────────

const VIOLATION_STYLES: Record<WestgardViolation, string> = {
  '1-2s': 'bg-amber-500/15 text-amber-400/80',
  '1-3s': 'bg-red-500/15   text-red-400/80',
  '2-2s': 'bg-red-500/15   text-red-400/80',
  'R-4s': 'bg-red-500/15   text-red-400/80',
  '4-1s': 'bg-red-500/15   text-red-400/80',
  '10x':  'bg-red-500/15   text-red-400/80',
};

function ViolationChip({ v }: { v: WestgardViolation }) {
  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${VIOLATION_STYLES[v]}`}>
      {v}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RunItemProps {
  run:      Run;
  index:    number;
  onDelete: (runId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RunItem({ run, index, onDelete }: RunItemProps) {
  const [expanded,      setExpanded]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ts = new Date(run.timestamp);
  const formattedDate = ts.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const formattedTime = ts.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });

  const allViolations = [
    ...new Set(run.results.flatMap((r) => r.violations)),
  ] as WestgardViolation[];

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(run.id);
  }

  return (
    <div className={`rounded-xl border transition-all ${
      run.status === 'Rejeitada'
        ? 'border-red-500/20 bg-red-500/[0.03]'
        : run.status === 'Aprovada'
        ? 'border-white/[0.06]'
        : 'border-amber-500/20'
    }`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-mono text-white/25 w-6 shrink-0">#{index}</span>

        <StatusBadge status={run.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white/50">{formattedDate}</span>
            <span className="text-xs text-white/25">{formattedTime}</span>
            {run.sampleId && (
              <span className="text-xs text-white/35 font-mono">{run.sampleId}</span>
            )}
            {run.manualOverride && (
              <span className="text-[10px] text-violet-400/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                Manual
              </span>
            )}
          </div>
          {allViolations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {allViolations.map((v) => <ViolationChip key={v} v={v} />)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={`
              flex items-center justify-center w-7 h-7 rounded-lg transition-all
              ${confirmDelete
                ? 'bg-red-500/20 text-red-400'
                : 'text-white/20 hover:text-white/50 hover:bg-white/[0.06]'}
            `}
            title={confirmDelete ? 'Clique para confirmar' : 'Excluir corrida'}
          >
            <TrashIcon />
          </button>

          <span className="text-white/25">
            <ChevronIcon open={expanded} />
          </span>
        </div>
      </div>

      {/* Expanded: analyte table */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.05]">
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/25">
                  <th className="text-left pb-2 font-medium">Analito</th>
                  <th className="text-right pb-2 font-medium">Valor</th>
                  <th className="text-left pb-2 pl-2 font-medium">Unidade</th>
                  <th className="text-right pb-2 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {run.results.map((r) => {
                  const analyte = ANALYTE_MAP[r.analyteId];
                  if (!analyte) return null;
                  return (
                    <tr key={r.id}>
                      <td className="py-1.5 text-white/60 font-medium">{analyte.name}</td>
                      <td className={`py-1.5 text-right font-mono ${
                        r.violations.some((v) => v !== '1-2s')
                          ? 'text-red-400'
                          : r.violations.includes('1-2s')
                          ? 'text-amber-400'
                          : 'text-white/80'
                      }`}>
                        {r.value.toFixed(analyte.decimals)}
                      </td>
                      <td className="py-1.5 pl-2 text-white/25">{analyte.unit}</td>
                      <td className="py-1.5 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {r.violations.map((v) => <ViolationChip key={v} v={v} />)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {run.imageUrl && (
            <a
              href={run.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-violet-400/70 hover:text-violet-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Ver imagem original →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
