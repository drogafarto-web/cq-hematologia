/**
 * Hook: Date range filter for analytics dashboards
 *
 * Manages selected date range state with preset options:
 * - 30d: last 30 days (default)
 * - 90d: last 90 days
 * - 1y:  last 365 days
 * - custom: user-provided start/end dates
 *
 * Does NOT fetch from Firestore — filtering is applied client-side on
 * the pre-computed aggregates already in Zustand store.
 * Aggregate queries for wider ranges are handled by the dashboard hooks.
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = '30d' | '90d' | '1y' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  preset: DatePreset;
}

export interface DateRangeFilterState {
  range: DateRange;
  setPreset: (preset: Exclude<DatePreset, 'custom'>) => void;
  setCustomRange: (start: Date, end: Date) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Subtract N days from a date (no external dep — native Date arithmetic) */
function subDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() - days);
  return result;
}

const PRESET_DAYS: Record<Exclude<DatePreset, 'custom'>, number> = {
  '30d': 30,
  '90d': 90,
  '1y':  365,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns date range filter state with preset and custom range setters.
 *
 * Default: last 30 days.
 * All dates are relative to the moment setPreset is called (not component mount).
 *
 * @returns DateRangeFilterState
 */
export function useDateRangeFilter(): DateRangeFilterState {
  const [range, setRange] = useState<DateRange>(() => {
    const end = new Date();
    return {
      start: subDays(end, 30),
      end,
      preset: '30d',
    };
  });

  const setPreset = useCallback((preset: Exclude<DatePreset, 'custom'>) => {
    const end = new Date();
    setRange({
      start: subDays(end, PRESET_DAYS[preset]),
      end,
      preset,
    });
  }, []);

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setRange({ start, end, preset: 'custom' });
  }, []);

  return { range, setPreset, setCustomRange };
}
