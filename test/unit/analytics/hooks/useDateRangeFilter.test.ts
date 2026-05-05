/**
 * Unit tests for useDateRangeFilter
 *
 * Tests:
 * - Default preset is 30d
 * - setPreset updates range correctly
 * - setCustomRange stores custom dates
 * - Preset dates are relative to "now" (start < end, correct day count)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDateRangeFilter } from '../../../../src/features/analytics/hooks/useDateRangeFilter';

// Fix "now" so tests are deterministic
const FAKE_NOW = new Date('2026-05-05T12:00:00.000Z');

describe('useDateRangeFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to last 30 days preset', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    expect(result.current.range.preset).toBe('30d');
  });

  it('default start is approximately 30 days before end', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    const diffMs = result.current.range.end.getTime() - result.current.range.start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('setPreset("90d") sets start 90 days before now', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    act(() => {
      result.current.setPreset('90d');
    });
    expect(result.current.range.preset).toBe('90d');
    const diffMs = result.current.range.end.getTime() - result.current.range.start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(90);
  });

  it('setPreset("1y") sets start 365 days before now', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    act(() => {
      result.current.setPreset('1y');
    });
    expect(result.current.range.preset).toBe('1y');
    const diffMs = result.current.range.end.getTime() - result.current.range.start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(365);
  });

  it('setCustomRange stores custom start and end with preset=custom', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    const customStart = new Date('2026-01-01');
    const customEnd = new Date('2026-03-31');

    act(() => {
      result.current.setCustomRange(customStart, customEnd);
    });

    expect(result.current.range.preset).toBe('custom');
    expect(result.current.range.start).toEqual(customStart);
    expect(result.current.range.end).toEqual(customEnd);
  });

  it('setPreset overwrites a previous custom range', () => {
    const { result } = renderHook(() => useDateRangeFilter());

    act(() => {
      result.current.setCustomRange(new Date('2026-01-01'), new Date('2026-02-01'));
    });
    expect(result.current.range.preset).toBe('custom');

    act(() => {
      result.current.setPreset('30d');
    });
    expect(result.current.range.preset).toBe('30d');
  });

  it('end date is always equal to now (within 1 second) after setPreset', () => {
    const { result } = renderHook(() => useDateRangeFilter());
    act(() => {
      result.current.setPreset('90d');
    });
    const diffFromNow = Math.abs(result.current.range.end.getTime() - FAKE_NOW.getTime());
    expect(diffFromNow).toBeLessThan(1000);
  });
});
