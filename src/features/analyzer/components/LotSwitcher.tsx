import { useState, useRef, useEffect, useMemo } from 'react';
import type { ControlLot } from '../../../types';

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /**
   * Agrupamento por status (D1) — EM USO → DISPONÍVEIS → VENCIDOS. Substitui o
   * agrupamento por mês (que forçava o operador a decodificar datas pra achar
   * qual lote rodar). Dentro de cada grupo, ordena por nível pra leitura rápida.
   */
  const grouped = useMemo(() => {
    const now = Date.now();
    const sortByLevel = (a: ControlLot, b: ControlLot) => (a.level ?? 0) - (b.level ?? 0);
    const activeId = activeLot?.id ?? null;
    const emUso: ControlLot[] = [];
    const disponiveis: ControlLot[] = [];
    const vencidos: ControlLot[] = [];
    for (const lot of lots) {
      const isActive = lot.id === activeId;
      const isExpired = lot.expiryDate.getTime() < now;
      if (isActive && !isExpired) emUso.push(lot);
      else if (isExpired) vencidos.push(lot);
      else disponiveis.push(lot);
    }
    return [
      { key: 'em-uso' as const, label: 'Em uso', lots: emUso.sort(sortByLevel) },
      { key: 'disp' as const, label: 'Disponíveis', lots: disponiveis.sort(sortByLevel) },
      { key: 'venc' as const, label: 'Vencidos', lots: vencidos.sort(sortByLevel) },
    ];
  }, [lots, activeLot]);

  if (!activeLot) return null;

  const levelLabel = `NV${activeLot.level}`;
  const monthYear = fmtMonthYear(activeLot.startDate);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-500/60 shadow-sm shadow-emerald-500/10 transition-all"
        title={`${activeLot.controlName} — Lote ${activeLot.lotNumber} em uso`}
      >
        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-500 text-white">
          EM USO
        </span>
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
          <div className="absolute left-0 top-9 z-40 w-72 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.10] shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Trocar lote ativo
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {grouped.map((group, groupIdx) => {
                if (group.lots.length === 0) return null;
                const isPrimary = group.key === 'em-uso';
                const isVencido = group.key === 'venc';
                return (
                  <div key={group.key}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 ${
                        isPrimary
                          ? 'bg-emerald-50 dark:bg-emerald-500/[0.06]'
                          : 'bg-slate-50 dark:bg-white/[0.03]'
                      } ${groupIdx > 0 ? 'border-t border-slate-200 dark:border-white/[0.07]' : ''}`}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider flex-1 ${
                          isPrimary
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {group.label}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {group.lots.length}
                      </span>
                    </div>
                    {group.lots.map((lot) => {
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
                              ? 'bg-emerald-600 text-white'
                              : isVencido
                                ? 'text-slate-500 dark:text-white/45 opacity-70 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
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
