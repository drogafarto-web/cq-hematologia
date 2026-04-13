import React, { useState } from 'react';
import { ANALYTE_MAP } from '../../constants';
import type { PendingRun, ControlLot } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.85 ? 'bg-emerald-500' :
    value >= 0.6  ? 'bg-amber-500'   :
                    'bg-red-500';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color}`}
      title={`Confiança: ${pct}%`}
    />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReviewRunModalProps {
  pendingRun:  PendingRun;
  activeLot:   ControlLot;
  onConfirm:   (manualOverride?: boolean) => Promise<void>;
  onCancel:    () => void;
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
  const [manualOverride, setManualOverride] = useState(false);
  // Editable values (starts from AI extraction)
  const [editedValues, setEditedValues] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        Object.entries(pendingRun.results).map(([id, r]) => {
          const analyte = ANALYTE_MAP[id];
          return [id, r.value.toFixed(analyte?.decimals ?? 2)];
        }),
      ),
  );

  const imageUrl = URL.createObjectURL(pendingRun.file);

  const lowConfidenceCount = Object.values(pendingRun.results)
    .filter((r) => r.confidence < 0.85).length;

  function handleValueChange(analyteId: string, raw: string) {
    setEditedValues((prev) => ({ ...prev, [analyteId]: raw }));
  }

  async function handleConfirm() {
    await onConfirm(manualOverride);
  }

  // Build ordered list of analytes in this lot
  const analyteEntries = activeLot.requiredAnalytes
    .map((id) => {
      const analyte = ANALYTE_MAP[id];
      const result  = pendingRun.results[id];
      return analyte && result ? { analyte, result, id } : null;
    })
    .filter(Boolean) as { analyte: (typeof ANALYTE_MAP)[string]; result: PendingRun['results'][string]; id: string }[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#141414] border border-white/[0.09] shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-white/[0.07] shrink-0">
          {/* Thumbnail */}
          <img
            src={imageUrl}
            alt="Foto do equipamento"
            className="w-16 h-16 rounded-xl object-cover border border-white/[0.1] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white/90">Revisar Extração</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {activeLot.controlName} — Nível {activeLot.level}
            </p>
            {pendingRun.sampleId && (
              <p className="text-xs text-white/40 mt-0.5">ID Amostra: {pendingRun.sampleId}</p>
            )}
            {lowConfidenceCount > 0 && (
              <p className="text-xs text-amber-400/80 mt-1">
                ⚠ {lowConfidenceCount} analito{lowConfidenceCount > 1 ? 's' : ''} com baixa confiança — revise os valores
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Analyte table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 font-medium">
                <th className="text-left pb-3 font-medium">Analito</th>
                <th className="text-right pb-3 font-medium">Valor</th>
                <th className="text-left pb-3 pl-3 font-medium">Unidade</th>
                <th className="text-right pb-3 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {analyteEntries.map(({ analyte, result, id }) => (
                <tr key={id} className="group">
                  <td className="py-2.5 text-white/70 font-medium">{analyte.name}</td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      step={Math.pow(10, -analyte.decimals)}
                      value={editedValues[id] ?? ''}
                      onChange={(e) => handleValueChange(id, e.target.value)}
                      className={`
                        w-20 text-right px-2 py-1 rounded-lg text-sm
                        bg-white/[0.05] border transition-all
                        focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08]
                        ${result.confidence < 0.85
                          ? 'border-amber-500/30 text-amber-300'
                          : 'border-transparent text-white/85 hover:border-white/[0.12]'}
                      `}
                    />
                  </td>
                  <td className="py-2.5 pl-3 text-white/30 text-xs">{analyte.unit}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ConfidenceDot value={result.confidence} />
                      <span className={`text-xs ${
                        result.confidence >= 0.85 ? 'text-emerald-400/70' :
                        result.confidence >= 0.6  ? 'text-amber-400/70'  :
                                                    'text-red-400/70'
                      }`}>
                        {Math.round(result.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 space-y-3">
          {/* Manual override toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setManualOverride((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${manualOverride ? 'bg-violet-600' : 'bg-white/[0.12]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${manualOverride ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <div>
              <p className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                Aprovar manualmente
              </p>
              <p className="text-xs text-white/30">
                Ignora regras Westgard e força status Aprovada
              </p>
            </div>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/50 hover:text-white/80 hover:border-white/[0.2] disabled:opacity-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {isConfirming ? (
                <><Spinner /> Confirmando…</>
              ) : (
                manualOverride ? '✓ Confirmar (Manual)' : '✓ Confirmar Corrida'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
