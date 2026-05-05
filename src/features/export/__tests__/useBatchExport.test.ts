/**
 * Tests for useBatchExport hook.
 *
 * Covers:
 * - selectedFormats starts empty
 * - toggleFormat adds/removes formats
 * - canInitiate derived from selectedFormats.size
 * - isFormatSelected returns correct boolean
 * - initiateBatch throws when no formats selected
 * - reset() clears all state
 *
 * Firebase is fully mocked — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Hoist mock variables so they are available inside vi.mock factories ────────
// vi.mock() calls are hoisted to the top of the file by Vitest; variables
// declared with vi.hoisted() are initialized before that hoisting occurs.

const { mockBatchExportCallable } = vi.hoisted(() => ({
  mockBatchExportCallable: vi.fn(),
}));

// ── Mock Firebase modules before importing the hook ──────────────────────────

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockBatchExportCallable),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => {}), // returns unsubscribe no-op
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
}));

vi.mock('../../../config/firebase.config', () => ({
  functions: {},
  db: {},
  auth: {},
  storage: {},
}));

vi.mock('../../../shared/services/firebase', () => ({
  db: {},
}));

// Import after mocks
import { useBatchExport } from '../hooks/useBatchExport';
import type { BatchExportFormat } from '../components/BatchFormatSelector';

const LAB_ID = 'lab-test-999';

describe('useBatchExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('selectedFormats starts as empty Set', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.selectedFormats.size).toBe(0);
    });

    it('jobStatuses starts empty', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.jobStatuses).toHaveLength(0);
    });

    it('loading starts false', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.loading).toBe(false);
    });

    it('error starts null', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.error).toBeNull();
    });

    it('allComplete is false when no jobs are being watched', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.allComplete).toBe(false);
    });

    it('anyFailed is false initially', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      expect(result.current.anyFailed).toBe(false);
    });
  });

  // ── canInitiate / selectedFormats.size ────────────────────────────────────

  describe('canInitiate (derived from selectedFormats)', () => {
    it('is false when selectedFormats is empty', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      // canInitiate = selectedFormats.size > 0
      expect(result.current.selectedFormats.size > 0).toBe(false);
    });

    it('is true when at least one format is selected', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
      });

      expect(result.current.selectedFormats.size > 0).toBe(true);
    });
  });

  // ── toggleFormat ──────────────────────────────────────────────────────────

  describe('toggleFormat', () => {
    it('adds a format to selectedFormats when not present', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
      });

      expect(result.current.selectedFormats.has('xlsx-ciq')).toBe(true);
    });

    it('removes a format when toggled a second time', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-nc');
      });
      act(() => {
        result.current.toggleFormat('xlsx-nc');
      });

      expect(result.current.selectedFormats.has('xlsx-nc')).toBe(false);
      expect(result.current.selectedFormats.size).toBe(0);
    });

    it('can have multiple formats selected at once', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
        result.current.toggleFormat('pdf-compliance');
        result.current.toggleFormat('csv-audit');
      });

      expect(result.current.selectedFormats.size).toBe(3);
      expect(result.current.selectedFormats.has('xlsx-ciq')).toBe(true);
      expect(result.current.selectedFormats.has('pdf-compliance')).toBe(true);
      expect(result.current.selectedFormats.has('csv-audit')).toBe(true);
    });

    it('does not affect other selected formats when deselecting one', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
        result.current.toggleFormat('xlsx-nc');
      });
      act(() => {
        result.current.toggleFormat('xlsx-ciq');
      });

      expect(result.current.selectedFormats.has('xlsx-ciq')).toBe(false);
      expect(result.current.selectedFormats.has('xlsx-nc')).toBe(true);
    });
  });

  // ── isFormatSelected ──────────────────────────────────────────────────────

  describe('isFormatSelected (via selectedFormats.has)', () => {
    it('returns false for a format that has not been selected', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));
      const format: BatchExportFormat = 'csv-audit';
      expect(result.current.selectedFormats.has(format)).toBe(false);
    });

    it('returns true for a format that was toggled on', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('csv-audit');
      });

      expect(result.current.selectedFormats.has('csv-audit')).toBe(true);
    });

    it('returns false after toggling off a previously selected format', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('pdf-compliance');
      });
      act(() => {
        result.current.toggleFormat('pdf-compliance');
      });

      expect(result.current.selectedFormats.has('pdf-compliance')).toBe(false);
    });
  });

  // ── initiateBatch errors ──────────────────────────────────────────────────

  describe('initiateBatch — guard rails', () => {
    it('throws when no formats are selected', async () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      await expect(
        act(async () => {
          await result.current.initiateBatch({
            labId: LAB_ID,
            dateRange: { start: '2026-01-01', end: '2026-03-31' },
          });
        }),
      ).rejects.toThrow('Selecione pelo menos um formato para exportar.');
    });
  });

  // ── initiateBatch — callable success path ─────────────────────────────────

  describe('initiateBatch — callable success', () => {
    it('calls the batchExport callable with correct payload and returns response', async () => {
      // Configure the module-level mockBatchExportCallable to resolve
      mockBatchExportCallable.mockResolvedValue({
        data: { jobIds: ['job-a', 'job-b'], batchId: 'batch-001' },
      });

      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
      });

      let response: Awaited<ReturnType<typeof result.current.initiateBatch>> | undefined;

      await act(async () => {
        response = await result.current.initiateBatch({
          labId: LAB_ID,
          dateRange: { start: '2026-01-01', end: '2026-03-31' },
        });
      });

      expect(response?.jobIds).toEqual(['job-a', 'job-b']);
      expect(response?.batchId).toBe('batch-001');
    });

    it('passes all selected formats in the callable payload', async () => {
      mockBatchExportCallable.mockResolvedValue({
        data: { jobIds: ['job-1', 'job-2', 'job-3'], batchId: 'batch-002' },
      });

      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
        result.current.toggleFormat('xlsx-nc');
        result.current.toggleFormat('csv-audit');
      });

      await act(async () => {
        await result.current.initiateBatch({
          labId: LAB_ID,
          dateRange: { start: '2026-01-01', end: '2026-03-31' },
        });
      });

      expect(mockBatchExportCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          labId: LAB_ID,
          formats: expect.arrayContaining(['xlsx-ciq', 'xlsx-nc', 'csv-audit']),
        }),
      );
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears selectedFormats', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.toggleFormat('xlsx-ciq');
        result.current.toggleFormat('xlsx-nc');
      });

      expect(result.current.selectedFormats.size).toBe(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.selectedFormats.size).toBe(0);
    });

    it('clears loading and error on reset', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.reset();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('clears jobStatuses on reset', () => {
      const { result } = renderHook(() => useBatchExport(LAB_ID));

      act(() => {
        result.current.reset();
      });

      expect(result.current.jobStatuses).toHaveLength(0);
    });
  });
});
