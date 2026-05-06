import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useChartData } from '../hooks/useChartData';
import * as useRunsModule from '../hooks/useRuns';
import * as useInternalStatsModule from '../hooks/useInternalStats';

// Mock the hooks
vi.mock('../hooks/useRuns');
vi.mock('../hooks/useInternalStats');

describe('useChartData', () => {
  const mockUseRuns = useRunsModule.useRuns as any;
  const mockUseInternalStats = useInternalStatsModule.useInternalStats as any;
  const now = Timestamp.now();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty points when no runs', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: { mean: 100, sd: 5 },
      available: false,
      progress: 0,
    });

    const { result } = renderHook(() =>
      useChartData(
        'lab1',
        'eq1',
        'analito1',
        'normal',
        { mean: 100, sd: 5 },
        'manufacturer'
      )
    );

    expect(result.current.points).toEqual([]);
    expect(result.current.lines).toHaveLength(7); // 7 reference lines
  });

  it('should return NaN stats for invalid manufacturer stats', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: null,
      available: false,
      progress: 0,
    });

    const { result } = renderHook(() =>
      useChartData('lab1', 'eq1', 'analito1', 'normal', null, 'manufacturer')
    );

    expect(Number.isNaN(result.current.mean)).toBe(true);
    expect(Number.isNaN(result.current.sd)).toBe(true);
  });

  it('should generate correct reference lines', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: null,
      available: false,
      progress: 0,
    });

    const { result } = renderHook(() =>
      useChartData('lab1', 'eq1', 'analito1', 'normal', { mean: 100, sd: 5 })
    );

    expect(result.current.lines).toEqual([
      { y: 85, label: '-3σ' },
      { y: 90, label: '-2σ' },
      { y: 95, label: '-1σ' },
      { y: 100, label: 'mean' },
      { y: 105, label: '+1σ' },
      { y: 110, label: '+2σ' },
      { y: 115, label: '+3σ' },
    ]);
  });

  it('should use internal stats when available and selected', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: { mean: 102, sd: 6 },
      available: true,
      progress: 1,
    });

    const { result } = renderHook(() =>
      useChartData(
        'lab1',
        'eq1',
        'analito1',
        'normal',
        { mean: 100, sd: 5 },
        'internal'
      )
    );

    expect(result.current.mean).toBe(102);
    expect(result.current.sd).toBe(6);
    expect(result.current.statsSource).toBe('internal');
  });

  it('should fallback to manufacturer stats if internal not available', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: null,
      available: false,
      progress: 0.5,
    });

    const { result } = renderHook(() =>
      useChartData(
        'lab1',
        'eq1',
        'analito1',
        'normal',
        { mean: 100, sd: 5 },
        'internal'
      )
    );

    expect(result.current.mean).toBe(100);
    expect(result.current.statsSource).toBe('manufacturer');
  });

  it('should mark isInternalReady correctly', () => {
    mockUseRuns.mockReturnValue({ runs: [], loading: false, error: null });
    mockUseInternalStats.mockReturnValue({
      stats: { mean: 100, sd: 5 },
      available: true,
      progress: 1,
    });

    const { result } = renderHook(() =>
      useChartData('lab1', 'eq1', 'analito1', 'normal', null)
    );

    expect(result.current.isInternalReady).toBe(true);
  });
});
