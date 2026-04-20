import { useState, useRef, useEffect } from 'react';
import type { ControlLot } from '../../../types';
import { groupByMonth } from '../../../shared/utils/lotUtils';

interface LotSwitcherProps {
  lots: ControlLot[];
  activeLot: ControlLot | null;
  selectLot: (id: string) => Promise<void>;
}

function fmtMonthYear(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

export function LotSwitcher({ lots, activeLot, selectLot }: LotSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!activeLot) return null;

  const levelLabel = `NV${activeLot.level}`;
  const monthYear = fmtMonthYear(activeLot.startDate);
  const groups = groupByMonth(lots);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-400 dark:hover:border-blue-500/60 shadow-sm transition-all"
      >
        <span className="font-mono font-bold text-[13px]">{levelLabel}</span>
        <span className="opacity-40">·</span>
        <span className="font-medium">{monthYear}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="opacity-50 ml-0.5"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-40 w-64 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.10] shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Trocar lote ativo
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {groups.map(({ key, label, lots: groupLots }, groupIdx) => {
                const hasAtual = groupLots.some((l) => l.expiryDate >= today);
                return (
                  <div key={key}>
                    {/* Month block header */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/[0.03] ${groupIdx > 0 ? 'border-t border-slate-200 dark:border-white/[0.07]' : ''}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 capitalize flex-1">
                        {label}
                      </span>
                      {hasAtual && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                          ATUAL
                        </span>
                      )}
                    </div>
                    {/* Lots in this month */}
                    {groupLots.map((lot) => {
                      const isActive = lot.id === activeLot.id;
                      return (
                        <button
                          key={lot.id}
                          type="button"
                          onClick={() => {
                            selectLot(lot.id);
                            setOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-700 dark:text-white/75 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <span
                            className={`text-xs font-mono font-semibold ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
                          >
                            NV{lot.level}
                          </span>
                          <span className="flex-1 text-[13px] truncate">
                            {lot.controlName ?? lot.lotNumber}
                          </span>
                          <span
                            className={`font-mono text-[10px] ${isActive ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}
                          >
                            {lot.lotNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
