/**
 * useEquipmentFilter unit tests
 *
 * Mocks Firestore onSnapshot to verify equipment is loaded and
 * multi-select toggle/clear behavior works correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Mock } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../src/shared/services/firebase', () => ({
  db: {},
  collection: vi.fn(() => 'mock-col'),
  query: vi.fn((_col, ..._constraints) => 'mock-query'),
  where: vi.fn(() => 'mock-where'),
  onSnapshot: vi.fn(),
}));

vi.mock('../../../src/store/useAuthStore', () => ({
  useActiveLabId: vi.fn(() => 'lab-test'),
}));

import { useEquipmentFilter } from '../../../src/features/analytics/hooks/useEquipmentFilter';
import { onSnapshot } from '../../../src/shared/services/firebase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useEquipmentFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (onSnapshot as Mock).mockImplementation((_q: unknown, cb: (snap: ReturnType<typeof makeSnap>) => void) => {
      cb(
        makeSnap([
          { id: 'eq1', data: { name: 'Yumizen H550', modelo: 'YUMIZEN_H550', deletadoEm: null } },
          { id: 'eq2', data: { name: 'Micros 60', modelo: 'MICROS_60', deletadoEm: null } },
        ]),
      );
      return () => {}; // unsubscribe
    });
  });

  it('loads equipment from Firestore on mount', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    expect(result.current.equipment).toHaveLength(2);
    // Sorted alphabetically: 'Micros 60' < 'Yumizen H550'
    expect(result.current.equipment[0].id).toBe('eq2');
    expect(result.current.equipment[0].name).toBe('Micros 60');
  });

  it('starts with no selection (isFiltering = false)', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isFiltering).toBe(false);
  });

  it('toggleEquipment adds an ID to selectedIds', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    act(() => {
      result.current.toggleEquipment('eq1');
    });
    expect(result.current.selectedIds.has('eq1')).toBe(true);
    expect(result.current.isFiltering).toBe(true);
  });

  it('toggleEquipment removes an ID when already selected', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    act(() => { result.current.toggleEquipment('eq1'); });
    act(() => { result.current.toggleEquipment('eq1'); });
    expect(result.current.selectedIds.has('eq1')).toBe(false);
    expect(result.current.isFiltering).toBe(false);
  });

  it('supports multi-select (multiple IDs)', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    act(() => {
      result.current.toggleEquipment('eq1');
      result.current.toggleEquipment('eq2');
    });
    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.isFiltering).toBe(true);
  });

  it('clearEquipment resets selection to empty', () => {
    const { result } = renderHook(() => useEquipmentFilter());
    act(() => { result.current.toggleEquipment('eq1'); });
    act(() => { result.current.clearEquipment(); });
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isFiltering).toBe(false);
  });

  it('returns empty equipment when labId is null', async () => {
    const authStore = await import('../../../src/store/useAuthStore');
    (authStore.useActiveLabId as Mock).mockReturnValue(null);

    const { result } = renderHook(() => useEquipmentFilter());
    expect(result.current.equipment).toHaveLength(0);
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});
