/**
 * DateRangePickerBar — Preset chip bar + custom date range picker
 *
 * Renders 3 preset chips (30 dias, 90 dias, 1 ano) and a "Personalizado" chip
 * that expands two <input type="date"> fields for arbitrary range selection.
 *
 * Active chip: bg-violet-500 text-white
 * Inactive chip: bg-white/5 text-white/60
 *
 * Mobile: chips in horizontal scroll row (overflow-x-auto)
 * Tablet+: chips in flex row, wrap allowed
 *
 * Uses only browser-native date inputs — no external date picker lib.
 */

import React, { useState, useCallback, useId } from 'react';
import type { DatePreset, DateRangeFilterState } from '../hooks/useDateRangeFilter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateRangePickerBarProps {
  /** Filter state from useDateRangeFilter() */
  range: DateRangeFilterState['range'];
  setPreset: DateRangeFilterState['setPreset'];
  setCustomRange: DateRangeFilterState['setCustomRange'];
  className?: string;
}

// ─── Preset config ────────────────────────────────────────────────────────────

interface PresetConfig {
  id: Exclude<DatePreset, 'custom'>;
  label: string;
  ariaLabel: string;
}

const PRESETS: PresetConfig[] = [
  { id: '30d', label: '30 dias', ariaLabel: 'Últimos 30 dias' },
  { id: '90d', label: '90 dias', ariaLabel: 'Últimos 90 dias' },
  { id: '1y',  label: '1 ano',   ariaLabel: 'Último ano' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD for <input type="date"> value */
function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD string from <input type="date"> to a Date at midnight local */
function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ─── Chip component ───────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  isActive: boolean;
  ariaLabel: string;
  onClick: () => void;
}

function Chip({ label, isActive, ariaLabel, onClick }: ChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      onClick={onClick}
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        'border transition-all duration-150 whitespace-nowrap',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
        isActive
          ? 'bg-violet-500 border-violet-500 text-white'
          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Custom range expander ────────────────────────────────────────────────────

interface CustomRangeProps {
  range: DateRangePickerBarProps['range'];
  setCustomRange: DateRangePickerBarProps['setCustomRange'];
  startId: string;
  endId: string;
}

function CustomRangeInputs({ range, setCustomRange, startId, endId }: CustomRangeProps) {
  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const start = fromInputDate(e.target.value);
      if (start) setCustomRange(start, range.end);
    },
    [range.end, setCustomRange],
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const end = fromInputDate(e.target.value);
      if (end) setCustomRange(range.start, end);
    },
    [range.start, setCustomRange],
  );

  const inputCls = [
    'rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-white/80',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
    'focus:border-violet-500/40',
    '[color-scheme:dark]',
  ].join(' ');

  return (
    <div className="flex items-center gap-2 mt-2 sm:mt-0">
      <div className="flex items-center gap-1.5">
        <label htmlFor={startId} className="text-xs text-white/40 whitespace-nowrap">
          De
        </label>
        <input
          id={startId}
          type="date"
          value={toInputDate(range.start)}
          max={toInputDate(range.end)}
          onChange={handleStartChange}
          className={inputCls}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label htmlFor={endId} className="text-xs text-white/40 whitespace-nowrap">
          Até
        </label>
        <input
          id={endId}
          type="date"
          value={toInputDate(range.end)}
          min={toInputDate(range.start)}
          max={toInputDate(new Date())}
          onChange={handleEndChange}
          className={inputCls}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DateRangePickerBar = React.memo(function DateRangePickerBar({
  range,
  setPreset,
  setCustomRange,
  className = '',
}: DateRangePickerBarProps) {
  const [showCustom, setShowCustom] = useState(range.preset === 'custom');
  const startId = useId();
  const endId = useId();

  const handlePresetClick = useCallback(
    (preset: Exclude<DatePreset, 'custom'>) => {
      setShowCustom(false);
      setPreset(preset);
    },
    [setPreset],
  );

  const handleCustomClick = useCallback(() => {
    setShowCustom(true);
    // Keep existing range but mark as custom so inputs show current dates
    setCustomRange(range.start, range.end);
  }, [range.start, range.end, setCustomRange]);

  return (
    <div
      className={['flex flex-wrap items-center gap-2', className].join(' ')}
      role="group"
      aria-label="Filtro de período"
    >
      {/* Preset chips — horizontal scroll on mobile */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
        {PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.label}
            isActive={!showCustom && range.preset === preset.id}
            ariaLabel={preset.ariaLabel}
            onClick={() => handlePresetClick(preset.id)}
          />
        ))}
        <Chip
          label="Personalizado"
          isActive={showCustom || range.preset === 'custom'}
          ariaLabel="Período personalizado"
          onClick={handleCustomClick}
        />
      </div>

      {/* Custom range inputs (expand when "Personalizado" is active) */}
      {(showCustom || range.preset === 'custom') && (
        <CustomRangeInputs
          range={range}
          setCustomRange={setCustomRange}
          startId={startId}
          endId={endId}
        />
      )}
    </div>
  );
});
