/**
 * Tests for useScheduledExport hook.
 *
 * Covers:
 * - updateConfig merges patch into localConfig
 * - updateConfig clears isSaved
 * - saveConfig returns early when labId is empty (no Firestore call)
 * - saveConfig calls setDoc with correct payload when labId is present
 * - isSaving transitions during saveConfig
 * - isSaved becomes true after successful save
 *
 * Firebase Firestore is fully mocked — no real network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Hoist mock variables ───────────────────────────────────────────────────────
// vi.mock() factories are hoisted; vi.hoisted() ensures these variables exist
// before that hoisting occurs.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOnSnapshot = vi.hoisted(() => vi.fn() as any);
const { mockSetDoc, mockDoc } = vi.hoisted(() => ({
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockDoc: vi.fn(() => ({})),
}));

// ── Mock Firebase modules ────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  getDoc: vi.fn(),
}));

vi.mock('../../../shared/services/firebase', () => ({
  db: {},
}));

// Import after mocks
import { useScheduledExport } from '../hooks/useScheduledExport';

describe('useScheduledExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: onSnapshot immediately calls callback with non-existent doc
    mockOnSnapshot.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
      // Simulate doc not existing (use defaults)
      onNext({ exists: () => false, data: () => undefined });
      return () => {};
    });
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('config.enabled defaults to false', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.config.enabled).toBe(false);
    });

    it('config.formats defaults to empty array', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.config.formats).toHaveLength(0);
    });

    it('config.emailRecipient defaults to empty string', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.config.emailRecipient).toBe('');
    });

    it('isSaving defaults to false', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.isSaving).toBe(false);
    });

    it('isSaved defaults to false', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.isSaved).toBe(false);
    });

    it('saveError defaults to null', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.saveError).toBeNull();
    });

    it('lastRunAt defaults to null', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));
      expect(result.current.lastRunAt).toBeNull();
    });
  });

  // ── updateConfig ──────────────────────────────────────────────────────────

  describe('updateConfig', () => {
    it('merges patch into config — toggling enabled', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      act(() => {
        result.current.updateConfig({ enabled: true });
      });

      expect(result.current.config.enabled).toBe(true);
    });

    it('merges patch without overwriting other fields', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      act(() => {
        result.current.updateConfig({ emailRecipient: 'lab@test.com' });
      });
      act(() => {
        result.current.updateConfig({ enabled: true });
      });

      expect(result.current.config.emailRecipient).toBe('lab@test.com');
      expect(result.current.config.enabled).toBe(true);
    });

    it('updates formats array', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      act(() => {
        result.current.updateConfig({ formats: ['xlsx-ciq', 'csv-audit'] });
      });

      expect(result.current.config.formats).toEqual(['xlsx-ciq', 'csv-audit']);
    });

    it('updates emailRecipient', () => {
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      act(() => {
        result.current.updateConfig({ emailRecipient: 'admin@lab.com.br' });
      });

      expect(result.current.config.emailRecipient).toBe('admin@lab.com.br');
    });

    it('clears isSaved when updateConfig is called', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      // First add a format so canSave would be true
      act(() => {
        result.current.updateConfig({ formats: ['xlsx-ciq'] });
      });

      // Trigger save to set isSaved = true
      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaved).toBe(true);

      // Now update config — isSaved should be cleared
      act(() => {
        result.current.updateConfig({ enabled: true });
      });

      expect(result.current.isSaved).toBe(false);
    });

    it('clears saveError when updateConfig is called', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore write failed'));
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      act(() => {
        result.current.updateConfig({ formats: ['xlsx-ciq'] });
      });

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.saveError).toBe('Firestore write failed');

      // updateConfig clears the error
      act(() => {
        result.current.updateConfig({ enabled: false });
      });

      expect(result.current.saveError).toBeNull();
    });
  });

  // ── saveConfig — early return when labId is empty ─────────────────────────

  describe('saveConfig — labId guard', () => {
    it('returns early without calling setDoc when labId is empty string', async () => {
      const { result } = renderHook(() => useScheduledExport(''));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('does not change isSaving when labId is empty', async () => {
      const { result } = renderHook(() => useScheduledExport(''));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  // ── saveConfig — success path ─────────────────────────────────────────────

  describe('saveConfig — success', () => {
    it('calls setDoc when labId is present', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    it('sets isSaved to true after successful save', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaved).toBe(true);
    });

    it('isSaving is false after save resolves', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('passes labId redundantly in the Firestore payload (multi-tenant)', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useScheduledExport('lab-multi'));

      await act(async () => {
        await result.current.saveConfig();
      });

      const [, payload] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(payload.labId).toBe('lab-multi');
    });
  });

  // ── saveConfig — error path ───────────────────────────────────────────────

  describe('saveConfig — error', () => {
    it('sets saveError when setDoc rejects', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.saveError).toBe('Permission denied');
    });

    it('isSaving is false after a failed save', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('isSaved remains false after a failed save', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));
      const { result } = renderHook(() => useScheduledExport('lab-123'));

      await act(async () => {
        await result.current.saveConfig();
      });

      expect(result.current.isSaved).toBe(false);
    });
  });

  // ── onSnapshot — loads Firestore data into config ─────────────────────────

  describe('onSnapshot — remote data loading', () => {
    it('populates config from Firestore document when doc exists', () => {
      mockOnSnapshot.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          exists: () => true,
          data: () => ({
            enabled: true,
            frequency: 'weekly',
            formats: ['xlsx-ciq', 'pdf-compliance'],
            emailRecipient: 'loaded@lab.com',
            lastRunAt: null,
          }),
        });
        return () => {};
      });

      const { result } = renderHook(() => useScheduledExport('lab-123'));

      expect(result.current.config.enabled).toBe(true);
      expect(result.current.config.formats).toEqual(['xlsx-ciq', 'pdf-compliance']);
      expect(result.current.config.emailRecipient).toBe('loaded@lab.com');
    });

    it('parses lastRunAt from Firestore Timestamp', () => {
      const fakeDate = new Date('2026-04-01T02:00:00Z');
      mockOnSnapshot.mockImplementation((_ref: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          exists: () => true,
          data: () => ({
            enabled: false,
            frequency: 'weekly',
            formats: [],
            emailRecipient: '',
            lastRunAt: { toDate: () => fakeDate },
          }),
        });
        return () => {};
      });

      const { result } = renderHook(() => useScheduledExport('lab-123'));

      expect(result.current.lastRunAt).toEqual(fakeDate);
    });
  });
});
