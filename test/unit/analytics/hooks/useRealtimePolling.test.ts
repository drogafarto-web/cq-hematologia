/**
 * Unit tests for useRealtimePolling — meta diff guard
 *
 * Validates:
 * - refreshAggregates called when lastRefreshAt timestamp changes
 * - refreshAggregates NOT called when lastRefreshAt unchanged
 * - Graceful handling of missing meta doc
 * - Graceful handling of getDoc failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (before imports) ──────────────────────────────────────────

const { mockGetDoc, mockRefreshAggregates, mockSetMetadata, mockStoreState } = vi.hoisted(() => {
  const mockGetDoc = vi.fn();
  const mockRefreshAggregates = vi.fn().mockResolvedValue(undefined);
  const mockSetMetadata = vi.fn();
  const mockStoreState = { metadata: null as null | object, setMetadata: mockSetMetadata };
  return { mockGetDoc, mockRefreshAggregates, mockSetMetadata, mockStoreState };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../../src/shared/services/firebase', () => ({
  getDoc: mockGetDoc,
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  db: {},
  collection: vi.fn(),
}));

vi.mock('../../../../src/store/useAuthStore', () => ({
  useActiveLabId: () => 'lab-test',
}));

vi.mock('../../../../src/features/analytics/services/analyticsService', () => ({
  AnalyticsService: {
    refreshAggregates: mockRefreshAggregates,
    refreshNow: vi.fn(),
    exportAnalytics: vi.fn(),
  },
}));

vi.mock('../../../../src/features/analytics/hooks/useAnalyticsCache', () => ({
  useAnalyticsStore: Object.assign(
    vi.fn(() => mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

vi.mock('../../../../src/features/analytics/services/analyticsQueries', () => ({
  analyticsMetaRef: (labId: string) => ({ path: `labs/${labId}/analytics/meta` }),
}));

// ─── Import SUT after mocks ───────────────────────────────────────────────────

import { checkForUpdatesTestOnly } from '../../../../src/features/analytics/hooks/useRealtimePolling';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useRealtimePolling — meta diff guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.metadata = null;
  });

  it('calls refreshAggregates when lastRefreshAt changes between polls', async () => {
    const ts1 = { toDate: () => new Date('2026-01-01T10:00:00.000Z') };
    const ts2 = { toDate: () => new Date('2026-01-01T11:00:00.000Z') };

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastRefreshAt: ts1 }),
    });

    // First call — sets baseline, triggers refresh (new ts)
    await checkForUpdatesTestOnly('lab-test', true);
    expect(mockRefreshAggregates).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();

    // Second call with NEW timestamp — should trigger refresh again
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastRefreshAt: ts2 }),
    });
    await checkForUpdatesTestOnly('lab-test');
    expect(mockRefreshAggregates).toHaveBeenCalledTimes(1);
  });

  it('does NOT call refreshAggregates when lastRefreshAt is unchanged', async () => {
    const ts = { toDate: () => new Date('2026-01-01T10:00:00.000Z') };

    // First call — sets baseline
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastRefreshAt: ts }),
    });
    await checkForUpdatesTestOnly('lab-test', true);
    vi.clearAllMocks();

    // Second call with SAME timestamp — must NOT refresh
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastRefreshAt: ts }),
    });
    await checkForUpdatesTestOnly('lab-test');
    expect(mockRefreshAggregates).not.toHaveBeenCalled();
  });

  it('does not refresh when meta document does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => null });

    await checkForUpdatesTestOnly('lab-test', true);
    expect(mockRefreshAggregates).not.toHaveBeenCalled();
  });

  it('handles getDoc failure without throwing', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await expect(checkForUpdatesTestOnly('lab-test')).resolves.not.toThrow();
    expect(mockRefreshAggregates).not.toHaveBeenCalled();
  });

  it('updates Zustand metadata when lastRefreshAt changes', async () => {
    const ts = { toDate: () => new Date('2026-01-01T10:00:00.000Z') };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ lastRefreshAt: ts }),
    });

    await checkForUpdatesTestOnly('lab-test', true);
    expect(mockSetMetadata).toHaveBeenCalledOnce();
    const callArg = mockSetMetadata.mock.calls[0][0] as { labId: string; lastRefreshAt: Date };
    expect(callArg.labId).toBe('lab-test');
    expect(callArg.lastRefreshAt).toBeInstanceOf(Date);
  });
});
