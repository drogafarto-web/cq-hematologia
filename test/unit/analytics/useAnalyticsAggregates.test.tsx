/**
 * Unit tests for useAnalyticsAggregates hook
 *
 * Mocks: Firestore onSnapshot, useActiveLabId, Zustand store actions
 * Tests: subscription setup, labId isolation, cleanup, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => {
  const storeActions = {
    resetForLab: vi.fn(),
    setAggregate: vi.fn(),
    setMetadata: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
  };

  const unsubMetrics = vi.fn();
  const unsubMeta = vi.fn();

  let metricsCallback: ((snap: any) => void) | null = null;
  let metaCallback: ((snap: any) => void) | null = null;
  let metricsErrorCallback: ((err: any) => void) | null = null;

  const mockOnSnapshot = vi.fn((ref: any, successCb: any, errorCb: any) => {
    if (ref && ref.__type === 'meta') {
      metaCallback = successCb;
      return unsubMeta;
    }
    metricsCallback = successCb;
    metricsErrorCallback = errorCb;
    return unsubMetrics;
  });

  let mockLabId: string | null = 'lab-001';

  return {
    storeActions,
    unsubMetrics,
    unsubMeta,
    get metricsCallback() { return metricsCallback; },
    set metricsCallback(v) { metricsCallback = v; },
    get metaCallback() { return metaCallback; },
    set metaCallback(v) { metaCallback = v; },
    get metricsErrorCallback() { return metricsErrorCallback; },
    set metricsErrorCallback(v) { metricsErrorCallback = v; },
    mockOnSnapshot,
    get mockLabId() { return mockLabId; },
    set mockLabId(v) { mockLabId = v; },
  };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/features/analytics/hooks/useAnalyticsCache', () => ({
  useAnalyticsStore: Object.assign(vi.fn(() => hoisted.storeActions), {
    getState: () => hoisted.storeActions,
  }),
  useAnalyticsAggregate: vi.fn(),
  useAnalyticsMetadata: vi.fn(),
  useAnalyticsLoading: vi.fn(),
  useAnalyticsRefreshing: vi.fn(),
  useAnalyticsError: vi.fn(),
}));

vi.mock('../../../src/shared/services/firebase', () => ({
  onSnapshot: hoisted.mockOnSnapshot,
  db: {},
  doc: vi.fn((_db: any, ...path: string[]) => ({
    __type: path[path.length - 1] === 'meta' ? 'meta' : 'metrics',
    path: path.join('/'),
  })),
  collection: vi.fn((_db: any, ...path: string[]) => ({ path: path.join('/') })),
}));

vi.mock('../../../src/features/analytics/services/analyticsQueries', () => ({
  ciqComplianceRef: vi.fn((labId: string) => ({ __type: 'metrics', labId })),
  analyticsMetaRef: vi.fn((labId: string) => ({ __type: 'meta', labId })),
  isValidLabId: (id: string | null) => typeof id === 'string' && id.length > 0,
}));

vi.mock('../../../src/store/useAuthStore', () => ({
  useActiveLabId: () => hoisted.mockLabId,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { useAnalyticsAggregates } from '../../../src/features/analytics/hooks/useAnalyticsAggregates';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAnalyticsAggregates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockLabId = 'lab-001';
    hoisted.metricsCallback = null;
    hoisted.metaCallback = null;
    hoisted.metricsErrorCallback = null;
  });

  it('resets the store for the current labId on mount', () => {
    renderHook(() => useAnalyticsAggregates());
    expect(hoisted.storeActions.resetForLab).toHaveBeenCalledWith('lab-001');
  });

  it('subscribes to metrics and meta listeners', () => {
    renderHook(() => useAnalyticsAggregates());
    expect(hoisted.mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('calls setLoading(false) when labId is null', () => {
    hoisted.mockLabId = null;
    renderHook(() => useAnalyticsAggregates());
    expect(hoisted.storeActions.setLoading).toHaveBeenCalledWith(false);
    expect(hoisted.mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('calls setAggregate(null) when snap does not exist', () => {
    renderHook(() => useAnalyticsAggregates());
    hoisted.metricsCallback?.({ exists: () => false, data: () => null });
    expect(hoisted.storeActions.setAggregate).toHaveBeenCalledWith(null);
  });

  it('calls setLoading(false) when snap does not exist', () => {
    renderHook(() => useAnalyticsAggregates());
    hoisted.metricsCallback?.({ exists: () => false, data: () => null });
    expect(hoisted.storeActions.setLoading).toHaveBeenCalledWith(false);
  });

  it('calls setError when snapshot listener errors', () => {
    renderHook(() => useAnalyticsAggregates());
    hoisted.metricsErrorCallback?.(new Error('Firestore permission denied'));
    expect(hoisted.storeActions.setError).toHaveBeenCalledWith(
      expect.stringContaining('Firestore permission denied'),
    );
  });

  it('unsubscribes from both listeners on unmount', () => {
    const { unmount } = renderHook(() => useAnalyticsAggregates());
    unmount();
    expect(hoisted.unsubMetrics).toHaveBeenCalled();
    expect(hoisted.unsubMeta).toHaveBeenCalled();
  });

  it('sets error for schema-invalid aggregate (empty labId)', () => {
    renderHook(() => useAnalyticsAggregates());
    // Simulate snapshot with labId empty string (fails Zod min(1))
    hoisted.metricsCallback?.({
      exists: () => true,
      data: () => ({ labId: '' }),
    });
    expect(hoisted.storeActions.setError).toHaveBeenCalledWith(
      expect.stringContaining('inválidos'),
    );
  });

  it('re-resets store when labId changes (multi-tenant isolation)', () => {
    hoisted.mockLabId = 'lab-001';
    const { rerender } = renderHook(() => useAnalyticsAggregates());
    expect(hoisted.storeActions.resetForLab).toHaveBeenCalledWith('lab-001');

    hoisted.mockLabId = 'lab-002';
    rerender();
    expect(hoisted.storeActions.resetForLab).toHaveBeenCalledWith('lab-002');
  });
});
