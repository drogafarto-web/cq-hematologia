import React, { useMemo, useState, useCallback } from 'react';
import { useUroLots } from '../hooks/useUroLots';
import { useUroAberturaAtiva } from '../hooks/useUroAberturaAtiva';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { UroanaliseLot, UroAberturaLote } from '../types/Uroanalise';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UroInsumoSelection {
  /** The selected lot. */
  lot: UroanaliseLot;
  /** The active abertura for this lot (may be null if no abertura exists yet). */
  abertura: UroAberturaLote | null;
}

export interface UroInsumoPickerProps {
  /** Filter lots by type: 'controle' or 'tira'. */
  tipo: 'controle' | 'tira';
  /** Currently selected lot ID (from lot type). */
  value?: string;
  /** Callback when selection changes — emits full selection object. */
  onChange: (selection: UroInsumoSelection | null) => void;
  /** Label shown above the picker. */
  label: string;
  /** Disable interaction. */
  disabled?: boolean;
  /** Custom placeholder for empty state. */
  emptyPlaceholder?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UroInsumoPicker({
  tipo,
  value,
  onChange,
  label,
  disabled = false,
  emptyPlaceholder,
}: UroInsumoPickerProps) {
  const { lots, isLoading, error } = useUroLots(tipo);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [open, setOpen] = useState(false);

  const [selectedLotId, setSelectedLotId] = useState<string | undefined>(value);

  const { abertura: selectedAbertura } = useUroAberturaAtiva(
    selectedLotId ? lots.find((l) => l.id === selectedLotId)?.labId : undefined,
    selectedLotId,
  );

  const filteredLots = useMemo(() => {
    if (!debouncedSearch) return lots;
    const term = debouncedSearch.toLowerCase();
    return lots.filter((l) => {
      const lotLabel =
        tipo === 'controle'
          ? `${l.loteControle} ${l.fabricanteControle}`
          : `${l.tiraReferencia ?? ''} ${l.tiraFabricante ?? ''} ${l.tiraNome ?? ''}`;
      return lotLabel.toLowerCase().includes(term);
    });
  }, [lots, debouncedSearch, tipo]);

  const validLots = useMemo(
    () => filteredLots.filter((l) => l.lotStatus !== 'reprovado'),
    [filteredLots],
  );

  const selectedLot = useMemo(() => lots.find((l) => l.id === value), [lots, value]);

  const handleSelect = useCallback(
    (lotId: string) => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) return;
      setSelectedLotId(lotId);
      if (lot.id === selectedLot?.id) {
        onChange({ lot, abertura: selectedAbertura });
      } else {
        onChange({ lot, abertura: null });
      }
      setOpen(false);
      setSearch('');
    },
    [onChange, lots, selectedLot?.id, selectedAbertura],
  );

  const lotDisplayLabel = useCallback(
    (lot: UroanaliseLot) => {
      if (tipo === 'controle') {
        return `${lot.loteControle} · ${lot.fabricanteControle}`;
      }
      return `${lot.tiraReferencia ?? ''} ${lot.tiraNome ?? ''} · ${lot.tiraFabricante ?? ''}`.trim();
    },
    [tipo],
  );

  const expiryLabel = useCallback((validadeStr: string | undefined) => {
    if (!validadeStr) return '';
    const parts = validadeStr.split('-');
    if (parts.length !== 3) return '';
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return '';
    const target = new Date(y, m - 1, d);
    const today = new Date();
    const diff = Math.round(
      (target.getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
        86400000,
    );
    if (diff < 0) return 'Expirado';
    if (diff < 30) return `Expira em ${diff}d`;
    return `Válido ${d}/${m}/${y}`;
  }, []);

  if (isLoading) {
    return <PickerSkeleton label={label} />;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
          {label}
        </label>
        <div className="text-xs text-red-500 dark:text-red-400">Erro ao carregar lotes.</div>
      </div>
    );
  }

  const isEmpty = lots.length === 0;
  const hasActiveAbertura = !isEmpty && lots.some((l) => l.lotStatus !== 'reprovado');

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
          {label}
        </label>
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] p-4 text-center">
          <p className="text-sm text-slate-500 dark:text-white/45">
            {emptyPlaceholder ?? 'Nenhum lote cadastrado.'}
          </p>
        </div>
      </div>
    );
  }

  if (!hasActiveAbertura) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
          {label}
        </label>
        <div className="rounded-lg border border-dashed border-amber-200/50 dark:border-amber-500/20 p-4 text-center">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Nenhum lote com abertura ativa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
        {label}
      </label>

      {/* Selected display / trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={[
          'w-full h-10 px-3 rounded-lg border text-left text-sm',
          'transition-colors duration-150',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          open
            ? 'border-amber-500/50 bg-amber-500/[0.04] dark:border-amber-500/40'
            : 'border-slate-200 dark:border-white/[0.10] bg-white/50 dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/[0.16]',
        ].join(' ')}
      >
        {selectedLot ? (
          <span className="flex items-center justify-between">
            <span className="text-slate-900 dark:text-white/90">
              {lotDisplayLabel(selectedLot)}
            </span>
            <span className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
          </span>
        ) : (
          <span className="text-slate-400 dark:text-white/30">Selecionar…</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={[
            'absolute z-50 top-full mt-1 w-full rounded-lg border shadow-xl',
            'bg-white dark:bg-[#181d24] border-slate-200 dark:border-white/[0.10]',
          ].join(' ')}
        >
          <div className="p-2 border-b border-slate-100 dark:border-white/[0.05]">
            <input
              type="text"
              placeholder="Buscar lote ou fabricante…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={[
                'w-full h-8 px-2 rounded-md text-sm bg-slate-50 dark:bg-white/[0.04]',
                'border border-slate-200 dark:border-white/[0.08]',
                'placeholder:text-slate-400 dark:placeholder:text-white/25',
                'focus:outline-none focus:ring-1 focus:ring-amber-500/40',
              ].join(' ')}
              autoFocus
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
            {validLots.length === 0 && debouncedSearch ? (
              <li className="px-3 py-2 text-sm text-slate-400 dark:text-white/30">
                Nenhum resultado para &ldquo;{debouncedSearch}&rdquo;.
              </li>
            ) : (
              validLots.map((lot) => (
                <li key={lot.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={lot.id === value}
                    onClick={() => handleSelect(lot.id)}
                    title={`Validade: ${expiryLabel(tipo === 'controle' ? lot.validadeControle : undefined)}`}
                    className={[
                      'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                      'transition-colors duration-100',
                      lot.id === value
                        ? 'bg-amber-500/[0.08] text-amber-700 dark:text-amber-300'
                        : 'text-slate-700 dark:text-white/80 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    <span>{lotDisplayLabel(lot)}</span>
                    <span
                      className={[
                        'text-[10px] tabular-nums',
                        lot.lotStatus === 'reprovado'
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400',
                      ].join(' ')}
                    >
                      {expiryLabel(tipo === 'controle' ? lot.validadeControle : undefined)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PickerSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
        {label}
      </label>
      <div className="h-10 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
    </div>
  );
}
