import React, { useState } from 'react';
import { NewRunForm } from '../../runs/NewRunForm';
import type { ControlLot, PendingRun } from '../../../types';
import { groupByMonth } from '../../../shared/utils/lotUtils';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = ['Lote', 'Captura', 'Revisão'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2.5">
              <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                done   ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-blue-600 border-blue-600 text-white' :
                'bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.12] text-slate-400 dark:text-slate-500'
              }`}>
                {done ? <CheckIcon /> : i + 1}
              </div>
              <span className={`text-[12.5px] font-medium transition-colors ${
                active ? 'text-slate-800 dark:text-white' :
                done   ? 'text-slate-500 dark:text-slate-400' :
                'text-slate-400 dark:text-slate-500'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 min-w-[30px] transition-colors ${done ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-slate-200 dark:bg-white/[0.08]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Lot picker ───────────────────────────────────────────────────────────────

interface LotPickerProps {
  lots:         ControlLot[];
  selectedId:   string | null;
  onSelect:     (id: string) => void;
  onConfirm:    () => void;
}

function LotPicker({ lots, selectedId, onSelect, onConfirm }: LotPickerProps) {
  const today  = new Date();
  const groups = groupByMonth(lots);

  if (lots.length === 0) {
    return (
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-10 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhum lote cadastrado</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cadastre um lote antes de registrar uma corrida</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
        <p className="text-sm font-semibold text-slate-700 dark:text-white/80">Selecione o lote de destino</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">A corrida será registrada no lote selecionado. Confirme antes de continuar.</p>
      </div>

      <div className="p-6 space-y-6">
        {groups.map(({ key, label, lots: groupLots }, groupIdx) => {
          const hasAtual = groupLots.some((l) => l.expiryDate >= today);
          const sorted   = [...groupLots].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
          return (
            <div key={key}>
              {/* Month header */}
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-white/[0.05] ${groupIdx > 0 ? 'mt-2' : ''}`}>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 capitalize">
                  {label}
                </span>
                {hasAtual && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    ATUAL
                  </span>
                )}
              </div>

              {/* Level cards */}
              <div className="grid grid-cols-3 gap-3">
                {sorted.map((lot) => {
                  const isSelected = lot.id === selectedId;
                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => onSelect(lot.id)}
                      className={`flex flex-col items-center gap-1.5 py-5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10 shadow-sm'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={`text-2xl font-bold tracking-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-white/75'}`}>
                        NV{lot.level}
                      </span>
                      <span className={`font-mono text-[11px] ${isSelected ? 'text-blue-500 dark:text-blue-400/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        {lot.lotNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {selectedId ? (() => {
            const lot = lots.find((l) => l.id === selectedId);
            return lot ? `Destino: NV${lot.level} · ${lot.lotNumber}` : '';
          })() : 'Nenhum lote selecionado'}
        </span>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedId}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuar <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lots:         ControlLot[];
  activeLot:    ControlLot | null;
  selectLot:    (id: string) => Promise<void>;
  pendingRun:   PendingRun | null;
  newRun:       (file: File) => Promise<void>;
  isExtracting: boolean;
  error:        string | null;
  goTo:         (page: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NovaCorridaScreen({ lots, activeLot, selectLot, pendingRun, newRun, isExtracting, error, goTo }: Props) {
  const [selectedId,   setSelectedId]   = useState<string | null>(activeLot?.id ?? null);
  const [confirmedId,  setConfirmedId]  = useState<string | null>(null);

  const step = confirmedId === null ? 0 : pendingRun ? 2 : 1;

  async function handleConfirm() {
    if (!selectedId) return;
    await selectLot(selectedId);
    setConfirmedId(selectedId);
  }

  function handleBack() {
    setConfirmedId(null);
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Nova corrida de controle</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">Registro de um ponto de controle interno · exige captura ou upload</p>
        </div>
        <div className="ml-auto flex gap-2">
          {confirmedId && !pendingRun && (
            <button type="button" onClick={handleBack}
              className="h-9 px-3.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
              ← Voltar
            </button>
          )}
          <button type="button" onClick={() => goTo('dashboard')}
            className="h-9 px-3.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
            Cancelar
          </button>
        </div>
      </div>

      <StepIndicator current={step} />

      {step === 0 && (
        <LotPicker
          lots={lots}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onConfirm={handleConfirm}
        />
      )}

      {step === 1 && (
        <NewRunForm onFile={newRun} isExtracting={isExtracting} error={error} />
      )}

      {step === 2 && (
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Processando corrida…</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Revise os resultados no painel que acabou de abrir</p>
        </div>
      )}
    </>
  );
}
