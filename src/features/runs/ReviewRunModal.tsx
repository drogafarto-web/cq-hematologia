import React, { useMemo, useState } from 'react';
import { ANALYTE_MAP } from '../../constants';
import { checkWestgardRules, isRejection } from '../chart/utils/westgardRules';
import { InsumoPickerMulti } from '../insumos/components/InsumoPickerMulti';
import type { Insumo } from '../insumos/types/Insumo';
import type { PendingRun, ControlLot, WestgardViolation, AnalyteStats } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? 'bg-emerald-500' : value >= 0.6 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={`Confiança: ${pct}%`} />
  );
}

// ─── Westgard violation descriptions ─────────────────────────────────────────

interface ViolationInfo {
  level: 'warning' | 'rejection';
  text: string;
}

const VIOLATION_INFO: Record<WestgardViolation, ViolationInfo> = {
  '1-2s': { level: 'warning', text: 'Valor além de ±2 DP — monitorar' },
  '1-3s': { level: 'rejection', text: 'Valor além de ±3 DP — possível erro analítico' },
  '2-2s': {
    level: 'rejection',
    text: '2 medições consecutivas além de ±2 DP no mesmo lado — desvio sistemático',
  },
  'R-4s': {
    level: 'rejection',
    text: 'Amplitude > 4 DP entre medições consecutivas — erro aleatório',
  },
  '4-1s': {
    level: 'rejection',
    text: '4 medições consecutivas além de ±1 DP no mesmo lado — tendência',
  },
  '10x': {
    level: 'rejection',
    text: '10 medições consecutivas do mesmo lado da média — erro sistemático',
  },
  '6T': { level: 'rejection', text: '6 medições em deriva monotônica — instabilidade analítica' },
  '6X': { level: 'rejection', text: '6 medições do mesmo lado da média — desvio sistemático' },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function resolveStats(lot: ControlLot, analyteId: string): AnalyteStats | null {
  return lot.statistics?.[analyteId] ?? lot.manufacturerStats[analyteId] ?? null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReviewRunModalProps {
  pendingRun: PendingRun;
  activeLot: ControlLot;
  onConfirm: (
    editedValues: Record<string, number>,
    approve: boolean,
    reagentes: Insumo[],
  ) => Promise<void>;
  onCancel: () => void;
  isConfirming: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewRunModal({
  pendingRun,
  activeLot,
  onConfirm,
  onCancel,
  isConfirming,
}: ReviewRunModalProps) {
  const [editedValues, setEditedValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(pendingRun.results).map(([id, r]) => {
        const analyte = ANALYTE_MAP[id];
        return [id, r.value.toFixed(analyte?.decimals ?? 2)];
      }),
    ),
  );

  // Reagentes em uso no equipamento durante esta corrida — opcional, usado
  // para FR-10 (rastreabilidade de insumos). Não bloqueia approve/reject.
  const [reagentes, setReagentes] = useState<Insumo[]>([]);

  const imageUrl = URL.createObjectURL(pendingRun.file);

  const lowConfidenceCount = Object.values(pendingRun.results).filter(
    (r) => r.confidence < 0.85,
  ).length;

  function handleValueChange(analyteId: string, raw: string) {
    setEditedValues((prev) => ({ ...prev, [analyteId]: raw }));
  }

  async function handleSubmit(approve: boolean) {
    const parsed = Object.fromEntries(
      Object.entries(editedValues).map(([id, raw]) => [id, parseFloat(raw)]),
    );
    await onConfirm(parsed, approve, reagentes);
  }

  // Build ordered list of analytes in this lot
  const analyteEntries = activeLot.requiredAnalytes
    .map((id) => {
      const analyte = ANALYTE_MAP[id];
      const result = pendingRun.results[id];
      return analyte && result ? { analyte, result, id } : null;
    })
    .filter(Boolean) as {
    analyte: (typeof ANALYTE_MAP)[string];
    result: PendingRun['results'][string];
    id: string;
  }[];

  // ── Live violation computation ──────────────────────────────────────────────
  // Re-evaluated whenever the operator edits a value.
  // Uses the lot's existing run history for multi-point rules.

  interface ViolationEntry {
    rule: WestgardViolation;
    analyteName: string;
    level: 'warning' | 'rejection';
    text: string;
  }

  const { violationEntries, hasRejectionViolation } = useMemo(() => {
    const sortedRuns = [...activeLot.runs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    const entries: ViolationEntry[] = [];
    let hasRejection = false;

    for (const { analyte, id } of analyteEntries) {
      const currentValue = parseFloat(editedValues[id] ?? '');
      if (Number.isNaN(currentValue)) continue;

      const stats = resolveStats(activeLot, id);
      if (!stats) continue;

      const previousValues = sortedRuns
        .map((r) => r.results.find((res) => res.analyteId === id)?.value)
        .filter((v): v is number => v !== undefined);

      const violations = checkWestgardRules(currentValue, previousValues, stats);

      for (const rule of violations) {
        const info = VIOLATION_INFO[rule];
        entries.push({ rule, analyteName: analyte.name, level: info.level, text: info.text });
        if (info.level === 'rejection') hasRejection = true;
      }
    }

    return { violationEntries: entries, hasRejectionViolation: hasRejection };
    // editedValues key is stable; only the values inside change — spread forces re-evaluation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedValues, activeLot]);

  const hasAnyViolation = violationEntries.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-[6px] transition-colors duration-500">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.09] shadow-2xl transition-colors duration-300">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
          <img
            src={imageUrl}
            alt="Foto do equipamento"
            className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-white/[0.1] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white/90">
              Revisar Extração
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
              {activeLot.controlName} — Nível {activeLot.level}
            </p>
            {pendingRun.sampleId && (
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                ID Amostra: {pendingRun.sampleId}
              </p>
            )}
            {lowConfidenceCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-1">
                ⚠ {lowConfidenceCount} analito{lowConfidenceCount > 1 ? 's' : ''} com baixa
                confiança — revise os valores
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            aria-label="Fechar"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Analyte table + reagentes */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 dark:text-white/30 font-medium">
                <th className="text-left pb-3 font-medium">Analito</th>
                <th className="text-right pb-3 font-medium">Valor</th>
                <th className="text-left pb-3 pl-3 font-medium">Unidade</th>
                <th className="text-right pb-3 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {analyteEntries.map(({ analyte, result, id }) => (
                <tr key={id} className="group transition-colors">
                  <td className="py-2.5 text-slate-700 dark:text-white/70 font-medium">
                    {analyte.name}
                  </td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      aria-label={`Valor de ${analyte.name}`}
                      step={Math.pow(10, -analyte.decimals)}
                      value={editedValues[id] ?? ''}
                      onChange={(e) => handleValueChange(id, e.target.value)}
                      className={`
                        w-20 text-right px-2 py-1 rounded-lg text-sm
                        bg-slate-50 dark:bg-white/[0.05] border transition-all
                        focus:outline-none focus:border-violet-500/50 dark:focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
                        ${
                          result.confidence < 0.85
                            ? 'border-amber-400/50 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                            : 'border-slate-100 dark:border-transparent text-slate-800 dark:text-white/85 hover:border-slate-300 dark:hover:border-white/[0.12]'
                        }
                      `}
                    />
                  </td>
                  <td className="py-2.5 pl-3 text-slate-400 dark:text-white/30 text-xs">
                    {analyte.unit}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ConfidenceDot value={result.confidence} />
                      <span
                        className={`text-xs ${
                          result.confidence >= 0.85
                            ? 'text-emerald-600 dark:text-emerald-400/70'
                            : result.confidence >= 0.6
                              ? 'text-amber-600 dark:text-amber-400/70'
                              : 'text-red-600 dark:text-red-400/70'
                        }`}
                      >
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Reagentes em uso — FR-10 rastreabilidade. Opcional; não bloqueia submit. */}
          <section aria-labelledby="reagentes-title" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3
                id="reagentes-title"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Reagentes em uso
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-white/30">
                opcional · rastreabilidade FR-10
              </span>
            </div>
            <InsumoPickerMulti
              tipo="reagente"
              modulo="hematologia"
              value={reagentes.map((r) => r.id)}
              onSelect={setReagentes}
              placeholder="Declarar reagentes carregados no equipamento (opcional)"
              ariaLabel="Selecionar reagentes em uso no equipamento"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0 space-y-3">
          {/* Westgard alerts panel — shown when violations are detected */}
          {hasAnyViolation && (
            <div
              className={`rounded-xl border p-3 space-y-1.5 transition-colors ${
                hasRejectionViolation
                  ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/[0.04]'
                  : 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.04]'
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${
                  hasRejectionViolation
                    ? 'text-red-600 dark:text-red-400/70'
                    : 'text-amber-600 dark:text-amber-400/70'
                }`}
              >
                Alertas Westgard
              </p>
              {violationEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      entry.level === 'rejection'
                        ? 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {entry.rule}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-white/50 leading-tight">
                    <span className="font-medium text-slate-700 dark:text-white/70">
                      {entry.analyteName}
                    </span>
                    {' — '}
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons — operator always decides */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/[0.1] text-sm text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80 hover:border-slate-300 dark:hover:border-white/[0.2] disabled:opacity-50 transition-all"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isConfirming}
              className="flex-1 py-2.5 rounded-xl border border-red-200 dark:border-red-500/20 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.07] hover:border-red-300 dark:hover:border-red-500/30 disabled:opacity-50 transition-all"
            >
              Rejeitar
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isConfirming}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all shadow-lg ${
                hasRejectionViolation
                  ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                  : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20'
              }`}
            >
              {isConfirming ? (
                <>
                  <Spinner /> Registrando…
                </>
              ) : hasRejectionViolation ? (
                '⚠ Aprovar mesmo assim'
              ) : (
                'Aprovar Corrida'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
