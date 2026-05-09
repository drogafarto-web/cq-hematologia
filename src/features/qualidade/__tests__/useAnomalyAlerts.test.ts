/**
 * useAnomalyAlerts.test.ts
 *
 * Tests for useAnomalyAlerts React hook.
 * Test cases:
 * 1. Subscribe to active alerts and receive data
 * 2. Real-time update when new alert added
 * 3. Dismiss alert via callable
 * 4. Unsubscribe cleanup on unmount
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { AuditAlert } from '../types/anomalyTypes';
import type { UseAnomalyAlertsReturn } from './useAnomalyAlerts';

// Mock Firebase services
vi.mock('../../../shared/services/firebase', () => ({
  db: {},
  functions: {},
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

import { useAnomalyAlerts } from '../hooks/useAnomalyAlerts';
import { onSnapshot } from 'firebase/firestore';
import { httpsCallable as httpsCallableClient } from 'firebase/functions';

describe('useAnomalyAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to active alerts and display them', async () => {
    const labId = 'lab-001';
    const mockAlerts: AuditAlert[] = [
      {
        id: 'alert-001',
        labId,
        anomalyScore: {
          entryId: 'entry-001',
          labId,
          operatorId: 'op-001',
          overallScore: 0.9,
          dimensions: [],
          computedAt: Date.now(),
        },
        severity: 'high',
        status: 'active',
        routedTo: ['auditor-001'],
        createdAt: Date.now(),
      },
    ];

    let snapshotCallback: any;
    vi.mocked(onSnapshot).mockImplementation((q, onNext) => {
      snapshotCallback = onNext;
      // Simulate snapshot with data
      setTimeout(() => {
        const mockSnapshot = {
          forEach: (callback: any) => {
            mockAlerts.forEach((alert) => {
              callback({
                id: alert.id,
                data: () => alert,
              });
            });
          },
        };
        onNext(mockSnapshot as any);
      }, 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useAnomalyAlerts(labId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].id).toBe('alert-001');
    expect(result.current.error).toBeNull();
  });

  it('should handle real-time updates', async () => {
    const labId = 'lab-001';
    let snapshotCallback: any;

    vi.mocked(onSnapshot).mockImplementation((q, onNext) => {
      snapshotCallback = onNext;
      return vi.fn();
    });

    const { result, rerender } = renderHook(() => useAnomalyAlerts(labId));

    // Simulate first snapshot
    const mockAlert1: AuditAlert = {
      id: 'alert-001',
      labId,
      anomalyScore: {
        entryId: 'entry-001',
        labId,
        operatorId: 'op-001',
        overallScore: 0.9,
        dimensions: [],
        computedAt: Date.now(),
      },
      severity: 'high',
      status: 'active',
      routedTo: ['auditor-001'],
      createdAt: Date.now(),
    };

    if (snapshotCallback) {
      const mockSnapshot1 = {
        forEach: (cb: any) => cb({ id: mockAlert1.id, data: () => mockAlert1 }),
      };
      snapshotCallback(mockSnapshot1);
    }

    await waitFor(() => {
      expect(result.current.alerts).toHaveLength(1);
    });

    // Simulate second snapshot with additional alert
    const mockAlert2: AuditAlert = {
      ...mockAlert1,
      id: 'alert-002',
      severity: 'critical',
    };

    if (snapshotCallback) {
      const mockSnapshot2 = {
        forEach: (cb: any) => {
          cb({ id: mockAlert1.id, data: () => mockAlert1 });
          cb({ id: mockAlert2.id, data: () => mockAlert2 });
        },
      };
      snapshotCallback(mockSnapshot2);
    }

    await waitFor(() => {
      expect(result.current.alerts).toHaveLength(2);
    });
  });

  it('should dismiss alert via callable', async () => {
    const labId = 'lab-001';
    const alertId = 'alert-001';
    const mockCallable = vi.fn().mockResolvedValue({ data: {} });

    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
    vi.mocked(httpsCallableClient).mockReturnValue(mockCallable);

    const { result } = renderHook(() => useAnomalyAlerts(labId));

    await result.current.dismissAlert(alertId, 'false positive');

    expect(mockCallable).toHaveBeenCalledWith({
      labId,
      alertId,
      reason: 'false positive',
    });
  });

  it('should cleanup subscription on unmount', async () => {
    const labId = 'lab-001';
    const mockUnsubscribe = vi.fn();

    vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useAnomalyAlerts(labId));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle missing lab ID', async () => {
    const { result } = renderHook(() => useAnomalyAlerts(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.alerts).toHaveLength(0);
  });
});
