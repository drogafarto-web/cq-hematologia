import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { UroInputField } from './UroInputField';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UroLotSidebarItem {
  id: string;
  nivel: 'N' | 'P';
  loteControle: string;
  fabricanteControle: string;
  validadeControle: string;
  status: 'valido' | 'atencao' | 'reprovado' | 'sem_dados';
  runCount: number;
  pinned?: boolean;
  setupType?: 'principal' | 'validacao_paralela' | null;
  lastRunAt?: number;
}

export interface UroLotSidebarProps {
  items: UroLotSidebarItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
  onCreateLot?: () => void;
  loading?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_DOT_CLASS: Record<UroLotSidebarItem['status'], string> = {
  valido: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  reprovado: 'bg-red-500',
  sem_dados: 'bg-slate-400 dark:bg-white/30',
};

const STATUS_LABEL: Record<UroLotSidebarItem['status'], string> = {
  valido: 'Válido',
  atencao: 'Atenção',
  reprovado: 'Reprovado',
  sem_dados: 'Sem dados',
};

function daysUntil(yyyyMmDd: string): number | null {
  if (!yyyyMmDd) return null;
  const parts = yyyyMmDd.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayMs) / 86400000);
}

function matchesQuery(item: UroLotSidebarItem, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.loteControle.toLowerCase().includes(needle) ||
    item.fabricanteControle.toLowerCase().includes(needle)
  );
}

// ─── Sub: Section header ─────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between px-3 pt-4 pb-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
        {title}
      </span>
      <span className="text-[10px] font-medium tabular-nums text-slate-400 dark:text-white/25">
        {count}
      </span>
    </div>
  );
}

// ─── Sub: Pin (bookmark) icon ────────────────────────────────────────────────

function PinIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// ─── Sub: Bench-pin icon (link) ──────────────────────────────────────────────

function BenchIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

// ─── Sub: Item row ───────────────────────────────────────────────────────────

interface RowProps {
  item: UroLotSidebarItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
}

const Row = React.memo(function Row({ item, selected, onSelect, onTogglePin }: RowProps) {
  const expiry = daysUntil(item.validadeControle);
  const expiringSoon = expiry !== null && expiry >= 0 && expiry < 30;
  const expired = expiry !== null && expiry < 0;

  const containerClass = [
    'group relative w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px]',
    'text-left transition-colors duration-150 ease-out',
    'focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60 focus-visible:ring-inset',
    selected
      ? 'bg-amber-500/[0.08] border border-amber-500/30'
      : 'border border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.03]',
  ].join(' ');

  const handleClick = () => onSelect(item.id);
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(item.id, !item.pinned);
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      data-lot-id={item.id}
      className={containerClass}
    >
      {/* Status dot */}
      <span
        className={`shrink-0 w-2 h-2 rounded-full ${STATUS_DOT_CLASS[item.status]}`}
        aria-label={STATUS_LABEL[item.status]}
        title={STATUS_LABEL[item.status]}
      />

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={[
              'shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
              'rounded text-[10px] font-semibold tabular-nums',
              item.nivel === 'N'
                ? 'bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-white/60'
                : 'bg-slate-200 text-slate-700 dark:bg-white/[0.12] dark:text-white/80',
            ].join(' ')}
            aria-label={item.nivel === 'N' ? 'Nível Normal' : 'Nível Patológico'}
          >
            {item.nivel}
          </span>
          <span
            className={[
              'truncate text-sm font-medium',
              selected
                ? 'text-slate-900 dark:text-white/95'
                : 'text-slate-800 dark:text-white/85',
            ].join(' ')}
          >
            {item.loteControle}
          </span>
          {item.setupType && (
            <span
              className="shrink-0 text-amber-600 dark:text-amber-400/80"
              title={
                item.setupType === 'principal'
                  ? 'Vinculado à bancada como principal'
                  : 'Vinculado à bancada em validação paralela'
              }
              aria-label="Vinculado à bancada"
            >
              <BenchIcon />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[11px] text-slate-500 dark:text-white/45">
            {item.fabricanteControle}
          </span>
          <span className="text-slate-300 dark:text-white/20" aria-hidden>
            ·
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-white/30">
            {item.runCount} {item.runCount === 1 ? 'run' : 'runs'}
          </span>
          {expired && (
            <>
              <span className="text-slate-300 dark:text-white/20" aria-hidden>
                ·
              </span>
              <span className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-400">
                expirado
              </span>
            </>
          )}
          {!expired && expiringSoon && (
            <>
              <span className="text-slate-300 dark:text-white/20" aria-hidden>
                ·
              </span>
              <span className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-400">
                expira em {expiry}d
              </span>
            </>
          )}
        </div>
      </div>

      {/* Pin toggle */}
      <button
        type="button"
        onClick={handlePinClick}
        aria-label={item.pinned ? 'Desfavoritar lote' : 'Favoritar lote'}
        aria-pressed={Boolean(item.pinned)}
        title={item.pinned ? 'Desfavoritar' : 'Favoritar'}
        className={[
          'shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-150',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60',
          item.pinned
            ? 'text-amber-500 hover:text-amber-400'
            : 'text-slate-300 dark:text-white/20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-slate-500 dark:hover:text-white/60',
        ].join(' ')}
      >
        <PinIcon filled={Boolean(item.pinned)} />
      </button>
    </div>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

export function UroLotSidebar({
  items,
  selectedId,
  onSelect,
  onTogglePin,
  onCreateLot,
  loading = false,
  className = '',
}: UroLotSidebarProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  // Filter + group items
  const { favoritos, vinculados, recentes, outros, flatOrder } = useMemo(() => {
    const filtered = items.filter((it) => matchesQuery(it, query));

    const fav: UroLotSidebarItem[] = [];
    const link: UroLotSidebarItem[] = [];
    const rest: UroLotSidebarItem[] = [];

    for (const it of filtered) {
      if (it.pinned) fav.push(it);
      else if (it.setupType) link.push(it);
      else rest.push(it);
    }

    fav.sort((a, b) => a.loteControle.localeCompare(b.loteControle));
    link.sort((a, b) => a.loteControle.localeCompare(b.loteControle));

    const restWithRecent = [...rest].sort((a, b) => (b.lastRunAt ?? 0) - (a.lastRunAt ?? 0));
    const rec = restWithRecent.filter((it) => it.lastRunAt).slice(0, 8);
    const recIds = new Set(rec.map((it) => it.id));
    const oth = rest
      .filter((it) => !recIds.has(it.id))
      .sort((a, b) => a.loteControle.localeCompare(b.loteControle));

    const order: string[] = [
      ...fav.map((it) => it.id),
      ...link.map((it) => it.id),
      ...rec.map((it) => it.id),
      ...oth.map((it) => it.id),
    ];

    return { favoritos: fav, vinculados: link, recentes: rec, outros: oth, flatOrder: order };
  }, [items, query]);

  const totalCount = items.length;
  const filteredCount = flatOrder.length;
  const isEmpty = !loading && filteredCount === 0;

  // Keyboard navigation: ArrowUp/Down / Enter / F or Cmd+D toggle pin
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (flatOrder.length === 0) return;
      const currentIdx = selectedId ? flatOrder.indexOf(selectedId) : -1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, flatOrder.length - 1);
        onSelect(flatOrder[next]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = currentIdx < 0 ? 0 : Math.max(currentIdx - 1, 0);
        onSelect(flatOrder[next]);
        return;
      }
      if (e.key === 'Enter' && currentIdx >= 0) {
        e.preventDefault();
        onSelect(flatOrder[currentIdx]);
        return;
      }
      // Toggle pin: F (no modifiers) or Cmd/Ctrl+D
      const isToggle =
        (e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey;
      const isCmdD = (e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey);
      if ((isToggle || isCmdD) && currentIdx >= 0) {
        e.preventDefault();
        const target = items.find((it) => it.id === flatOrder[currentIdx]);
        if (target) onTogglePin(target.id, !target.pinned);
      }
    },
    [flatOrder, selectedId, onSelect, onTogglePin, items]
  );

  // Scroll selected into view when it changes
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-lot-id="${selectedId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedId]);

  const containerClass = [
    'flex flex-col h-full overflow-hidden w-full max-w-xs',
    'bg-white dark:bg-[#0f1318]',
    'border-r border-slate-200 dark:border-white/[0.06]',
    className,
  ].join(' ');

  return (
    <aside className={containerClass} aria-label="Lista de lotes CIQ de uroanálise">
      {/* Header */}
      <div className="px-3 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white/90">
            Lotes CIQ
          </h2>
          {onCreateLot && (
            <button
              type="button"
              onClick={onCreateLot}
              className={[
                'inline-flex items-center gap-1 h-7 px-2.5 rounded-md',
                'text-[11px] font-semibold',
                'border border-slate-200 dark:border-white/[0.12]',
                'text-slate-600 dark:text-white/70',
                'hover:border-amber-500/50 hover:text-amber-600',
                'dark:hover:border-amber-500/40 dark:hover:text-amber-400',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60',
              ].join(' ')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden
                focusable="false"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Novo lote
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30 tabular-nums">
          {totalCount} {totalCount === 1 ? 'lote' : 'lotes'}
        </p>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <UroInputField
          value={query}
          onChange={setQuery}
          placeholder="Buscar lote ou fabricante."
          ariaLabel="Buscar lote ou fabricante"
        />
      </div>

      {/* List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Lotes de controle"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 focus-visible:ring-inset"
      >
        {loading && (
          <div className="px-3 py-2 space-y-2" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] animate-pulse motion-reduce:animate-none"
              >
                <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-white/[0.08]" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="text-sm text-slate-500 dark:text-white/45">Nenhum lote</span>
            <span className="text-[11px] text-slate-400 dark:text-white/30">
              {query
                ? 'Ajuste a busca ou limpe o filtro.'
                : onCreateLot
                  ? 'Crie um lote para começar.'
                  : 'Aguardando lotes do laboratório.'}
            </span>
          </div>
        )}

        {!loading && !isEmpty && (
          <div className="pb-4">
            {favoritos.length > 0 && (
              <section aria-label="Favoritos">
                <SectionHeader title="Favoritos" count={favoritos.length} />
                <div>
                  {favoritos.map((it) => (
                    <Row
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      onSelect={onSelect}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </section>
            )}

            {vinculados.length > 0 && (
              <section aria-label="Vinculados à bancada">
                <SectionHeader title="Vinculados à bancada" count={vinculados.length} />
                <div>
                  {vinculados.map((it) => (
                    <Row
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      onSelect={onSelect}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </section>
            )}

            {recentes.length > 0 && (
              <section aria-label="Recentes">
                <SectionHeader title="Recentes" count={recentes.length} />
                <div>
                  {recentes.map((it) => (
                    <Row
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      onSelect={onSelect}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </section>
            )}

            {outros.length > 0 && (
              <section aria-label="Outros">
                <SectionHeader title="Outros" count={outros.length} />
                <div>
                  {outros.map((it) => (
                    <Row
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      onSelect={onSelect}
                      onTogglePin={onTogglePin}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default UroLotSidebar;
