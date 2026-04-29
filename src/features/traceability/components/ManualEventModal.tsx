import React, { useState } from 'react';
import { useTraceability } from '../hooks/useTraceability';
import { UNIDADES, DEFAULT_EQUIPMENT_ID } from '../constants';
import type { TraceabilityEventType } from '../../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

interface ManualType {
  value: TraceabilityEventType;
  label: string;
  description: string;
}

const MANUAL_TYPES: ReadonlyArray<ManualType> = [
  {
    value: 'calibration',
    label: 'Calibração',
    description: 'Equipamento foi calibrado — ancora à próxima corrida.',
  },
  {
    value: 'maintenance',
    label: 'Manutenção',
    description: 'Manutenção preventiva ou corretiva realizada.',
  },
  {
    value: 'reagent_change',
    label: 'Troca de reagente (avulsa)',
    description: 'Use só se o lote não foi cadastrado pelo fluxo NovoLote.',
  },
  {
    value: 'control_run',
    label: 'Aprovação de controle (avulsa)',
    description: 'Use só se aprovou um controle fora do fluxo Nova Corrida.',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ManualEventModalProps {
  onClose: () => void;
  /** Pré-seleciona unidade e código (vindo da tela de consulta). */
  defaultUnidade?: string;
  defaultExamCode?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualEventModal({
  onClose,
  defaultUnidade,
  defaultExamCode,
}: ManualEventModalProps) {
  const { registerEvent, suggestNextExamCode } = useTraceability();

  const [type, setType] = useState<TraceabilityEventType>('calibration');
  const [unidade, setUnidade] = useState<string>(defaultUnidade ?? UNIDADES[0].code);
  const [examCode, setExamCode] = useState<string>(defaultExamCode ?? '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = suggestNextExamCode(unidade, DEFAULT_EQUIPMENT_ID);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = examCode.trim();
    if (!code) {
      setError('Informe o código de atendimento corrente.');
      return;
    }

    setSubmitting(true);
    try {
      await registerEvent({
        unidadeCode: unidade,
        equipmentId: DEFAULT_EQUIPMENT_ID,
        type,
        examCodeAtChange: code,
        timestamp: new Date(),
        payload: note.trim() ? { note: note.trim() } : {},
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar evento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar evento manual de rastreabilidade"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#0F1116] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">
              Registrar evento manual
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Calibração, manutenção ou ajuste retroativo. Append-only.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Type picker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Tipo de evento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MANUAL_TYPES.map((t) => {
                const active = t.value === type;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`text-left rounded-xl border-2 p-3 transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-white/85'}`}
                    >
                      {t.label}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unidade + código */}
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <div>
              <label
                htmlFor="manual-unidade"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Unidade
              </label>
              <select
                id="manual-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
              >
                {UNIDADES.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="manual-code"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Código de atendimento corrente
              </label>
              <input
                id="manual-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder={suggested ? `Sugestão: ${suggested}` : 'ex: 0107092'}
                value={examCode}
                onChange={(e) =>
                  setExamCode(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                className="w-full h-10 px-3 font-mono text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
              />
              {suggested && !examCode && (
                <button
                  type="button"
                  onClick={() => setExamCode(suggested)}
                  className="mt-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Usar sugestão {suggested}
                </button>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="manual-note"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Observação (opcional)
            </label>
            <textarea
              id="manual-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: troca de cartucho hemoglobina · técnico João · validado"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all resize-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-10 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !examCode.trim()}
              className="px-5 h-10 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? 'Salvando…' : 'Registrar evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
