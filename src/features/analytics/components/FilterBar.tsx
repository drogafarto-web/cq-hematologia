/**
 * FilterBar — Combined equipment + operator filter bar for analytics dashboards
 *
 * Receives filter state from useEquipmentFilter() and useOperatorFilter()
 * as props — no internal Firestore calls.
 *
 * Layout: flex row wrapping on narrow screens.
 * "Limpar filtros" link appears when either filter is active.
 *
 * Design: dark-first (bg-[#141417] surface, violet-500 accent, white/X alpha)
 * Accessibility: labels + aria-label on selects; "Limpar" is a button.
 *
 * Uses native <select> (no Radix — not in package.json).
 * Supports multi-select via native multiple attribute — renders as dropdown
 * with size=1 for clean UX; single selection switches the active filter.
 * Rationale: a single-item <select> (no multi=true) gives better mobile UX
 * and is sufficient for filtering a single equipment at a time; analytics
 * use case is "show me this equipment" not "compare all combos".
 */

import React, { useCallback, useId } from 'react';
import type { EquipmentFilterState } from '../hooks/useEquipmentFilter';
import type { OperatorFilterState } from '../hooks/useOperatorFilter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterBarProps {
  equipment: EquipmentFilterState;
  operators: OperatorFilterState;
  className?: string;
}

// ─── Select component ─────────────────────────────────────────────────────────

interface FilterSelectProps {
  id: string;
  label: string;
  placeholder: string;
  options: Array<{ id: string; label: string }>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isLoading?: boolean;
}

function FilterSelect({
  id,
  label,
  placeholder,
  options,
  selectedIds,
  onToggle,
  isLoading = false,
}: FilterSelectProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value) {
        onToggle(value);
        // Reset select back to placeholder so user can pick again
        e.target.value = '';
      }
    },
    [onToggle],
  );

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-white/40 whitespace-nowrap">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-label={label}
          disabled={isLoading || options.length === 0}
          onChange={handleChange}
          defaultValue=""
          className={[
            'appearance-none rounded-lg bg-white/5 border border-white/10',
            'px-3 py-1.5 pr-7 text-xs text-white/70',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus:border-violet-500/40',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-150',
            '[color-scheme:dark]',
          ].join(' ')}
        >
          <option value="" disabled>
            {isLoading ? 'Carregando…' : options.length === 0 ? 'Nenhum' : placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {selectedIds.has(opt.id) ? `✓ ${opt.label}` : opt.label}
            </option>
          ))}
        </select>
        {/* Caret icon */}
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/30"
          width={10}
          height={10}
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Active filter badge ──────────────────────────────────────────────────────

interface ActiveBadgeProps {
  label: string;
  onRemove: () => void;
}

function ActiveBadge({ label, onRemove }: ActiveBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-xs text-violet-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro: ${label}`}
        className="text-violet-300/60 hover:text-violet-200 transition-colors ml-0.5"
      >
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
          <path
            d="M2 2l6 6M8 2l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FilterBar — Combined equipment + operator filter dropdowns.
 *
 * Props are the return values of useEquipmentFilter() and useOperatorFilter().
 * Parent (AnalyticsHub) owns state; FilterBar is purely presentational.
 */
export const FilterBar = React.memo(function FilterBar({
  equipment,
  operators,
  className = '',
}: FilterBarProps) {
  const equipSelectId = useId();
  const opSelectId = useId();

  const isFiltering = equipment.isFiltering || operators.isFiltering;

  const handleClearAll = useCallback(() => {
    equipment.clearEquipment();
    operators.clearOperator();
  }, [equipment, operators]);

  const equipmentOptions = equipment.equipment.map((e) => ({
    id: e.id,
    label: e.name,
  }));

  const operatorOptions = operators.operators.map((o) => ({
    id: o.id,
    label: o.name,
  }));

  return (
    <div
      className={['flex items-center gap-4 flex-wrap', className].join(' ')}
      aria-label="Filtros de equipamento e operador"
    >
      {/* Equipment dropdown */}
      <FilterSelect
        id={equipSelectId}
        label="Equipamento"
        placeholder="Todos os equipamentos"
        options={equipmentOptions}
        selectedIds={equipment.selectedIds}
        onToggle={equipment.toggleEquipment}
        isLoading={equipment.isLoading}
      />

      {/* Operator dropdown */}
      <FilterSelect
        id={opSelectId}
        label="Operador"
        placeholder="Todos os operadores"
        options={operatorOptions}
        selectedIds={operators.selectedIds}
        onToggle={operators.toggleOperator}
        isLoading={operators.isLoading}
      />

      {/* Active filter badges */}
      {equipment.isFiltering && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from(equipment.selectedIds).map((id) => {
            const item = equipment.equipment.find((e) => e.id === id);
            if (!item) return null;
            return (
              <ActiveBadge
                key={id}
                label={item.name}
                onRemove={() => equipment.toggleEquipment(id)}
              />
            );
          })}
        </div>
      )}

      {operators.isFiltering && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from(operators.selectedIds).map((id) => {
            const item = operators.operators.find((o) => o.id === id);
            if (!item) return null;
            return (
              <ActiveBadge
                key={id}
                label={item.name}
                onRemove={() => operators.toggleOperator(id)}
              />
            );
          })}
        </div>
      )}

      {/* Clear all link */}
      {isFiltering && (
        <button
          type="button"
          onClick={handleClearAll}
          className={[
            'text-xs text-white/40 hover:text-white/70',
            'underline underline-offset-2 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 rounded',
          ].join(' ')}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
});
