'use client';

import { useState } from 'react';

interface Lot {
  id: string;
  lotNumber: string;
  analyte: string;
  level: number;
  reagentName: string;
  analyzer: { id: string; analyzerId: string; model: string };
}

interface Run {
  id: string;
  value: number;
  sdDistance: number;
  ruleViolated: string | null;
  isReject: boolean;
  isWarning: boolean;
  status: string;
  justification: string | null;
  runAt: string;
  operator: { name: string };
  lot: Lot;
}

interface RunDetailPanelProps {
  run: Run;
  onClose: () => void;
  onRelease: (justification: string) => void;
}

export function RunDetailPanel({ run, onClose, onRelease }: RunDetailPanelProps) {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPending = run.status === 'PENDING_JUSTIFICATION' && !run.justification;

  async function handleRelease() {
    if (justification.length < 10) return;
    setSubmitting(true);
    await onRelease(justification);
    setSubmitting(false);
  }

  const date = new Date(run.runAt);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-lg p-6 flex flex-col gap-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">Run Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-on-surface transition-colors text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Date
              </span>
              <span className="font-mono">{date.toLocaleDateString('pt-BR')}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Time
              </span>
              <span className="font-mono">
                {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Lot
              </span>
              <span className="font-mono">{run.lot.lotNumber}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Level
              </span>
              <span>{run.lot.level}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Analyte
              </span>
              <span>{run.lot.analyte}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Reagent
              </span>
              <span>{run.lot.reagentName}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Analyzer
              </span>
              <span className="font-mono">{run.lot.analyzer.analyzerId}</span>
            </div>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Result
              </span>
              <span className="font-mono text-lg">{run.value.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                ±SD
              </span>
              <span className="font-mono text-lg">
                {(run.sdDistance >= 0 ? '+' : '') + run.sdDistance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
              Status
            </span>
            <span
              className={`font-semibold ${run.status === 'PENDING_JUSTIFICATION' ? 'text-warning' : 'text-success'}`}
            >
              {run.status === 'PENDING_JUSTIFICATION' ? 'Pending Justification' : 'Released'}
            </span>
          </div>

          {run.ruleViolated && (
            <div className="border-t border-border pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Rule Violated
              </span>
              <span
                className={`font-mono font-semibold ${run.isReject ? 'text-error' : 'text-warning'}`}
              >
                {run.ruleViolated}
              </span>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
              Operator
            </span>
            <span>{run.operator.name}</span>
          </div>

          {run.justification && (
            <div className="border-t border-border pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline block">
                Justification
              </span>
              <p className="text-sm mt-1">{run.justification}</p>
            </div>
          )}

          {isPending && (
            <div className="border-t border-border pt-3 flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                Justification Required
              </span>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Describe the justification (min 10 characters)..."
                rows={4}
                className="w-full px-3 py-2 border border-border rounded text-sm font-sans resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                disabled={justification.length < 10 || submitting}
                onClick={handleRelease}
                className="h-12 w-full bg-primary text-white font-semibold rounded text-sm hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Releasing...' : 'Release with Justification'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
