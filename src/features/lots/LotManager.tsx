import React, { useState } from 'react';
import { AddLotModal } from './AddLotModal';
import type { ControlLot } from '../../types';
import type { AddLotInput } from './hooks/useLots';
import { groupByMonth } from '../../shared/utils/lotUtils';

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M12 3.5l-.8 8a1 1 0 01-1 .9H3.8a1 1 0 01-1-.9L2 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
  2: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
  3: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20',
};

function LotBadge({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LEVEL_COLORS[level]}`}>
      NV{level}
    </span>
  );
}

function ExpiryLabel({ date }: { date: Date }) {
  const diff = date.getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  const fmtd = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (days < 0) return <span className="text-xs text-red-600 dark:text-red-400/80">Vencido</span>;
  if (days <= 30)
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400/80">
        {fmtd} ({days}d)
      </span>
    );
  return <span className="text-xs text-slate-400 dark:text-white/30">{fmtd}</span>;
}

// ─── Lot row ──────────────────────────────────────────────────────────────────

interface LotRowProps {
  lot: ControlLot;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function LotRow({ lot, active, onSelect, onDelete }: LotRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  }

  const expired = lot.expiryDate.getTime() < Date.now();

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-violet-500/[0.12] border border-violet-500/30'
          : 'border border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.07]'
      } ${expired ? 'opacity-50' : ''}`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-violet-500" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <LotBadge level={lot.level} />
          <span
            className={`text-sm font-medium truncate ${active ? 'text-slate-900 dark:text-white/90' : 'text-slate-600 dark:text-white/70'}`}
          >
            {lot.controlName}
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-white/35 truncate">Lote {lot.lotNumber}</p>
        <div className="flex items-center gap-3 mt-1">
          <ExpiryLabel date={lot.expiryDate} />
          <span className="text-xs text-slate-400 dark:text-white/25">{lot.runCount} corridas</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        onBlur={() => setConfirmDelete(false)}
        aria-label={confirmDelete ? 'Confirmar exclusão' : 'Excluir lote'}
        className={`shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
          confirmDelete
            ? 'bg-red-500/20 text-red-500'
            : 'text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.07]'
        }`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LotManagerProps {
  lots: ControlLot[];
  activeLotId: string | null;
  showAdd: boolean;
  onCloseAdd: () => void;
  onAdd: (input: AddLotInput) => Promise<string>;
  onDelete: (lotId: string) => Promise<void>;
  onSelect: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LotManager({
  lots,
  activeLotId,
  showAdd,
  onCloseAdd,
  onAdd,
  onDelete,
  onSelect,
}: LotManagerProps) {
  const groups = groupByMonth(lots);
  const today = new Date();

  if (lots.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.07] flex items-center justify-center mb-3 text-slate-400 dark:text-white/20">
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
              <rect
                x="2"
                y="2"
                width="14"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M9 6v6M6 9h6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/40 font-medium">
            Nenhum lote cadastrado
          </p>
          <p className="text-xs text-slate-400 dark:text-white/20 mt-1">
            Clique em "+ Novo lote" para começar
          </p>
        </div>
        {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} />}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groups.map(({ key, label, lots: groupLots }) => {
          const hasAtual = groupLots.some((l) => l.expiryDate >= today);
          const sorted = [...groupLots].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
          return (
            <div
              key={key}
              className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none"
            >
              {/* Month header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02]">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 capitalize">
                  {label}
                </span>
                {hasAtual && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    ATUAL
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                  {sorted.length} nível{sorted.length !== 1 ? 'eis' : ''}
                </span>
              </div>
              {/* Lot rows */}
              <div className="p-2 space-y-0.5">
                {sorted.map((lot) => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    active={lot.id === activeLotId}
                    onSelect={() => onSelect(lot.id)}
                    onDelete={() => onDelete(lot.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <AddLotModal onAdd={onAdd} onClose={onCloseAdd} />}
    </>
  );
}
