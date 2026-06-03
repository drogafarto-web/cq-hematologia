import { useEffect, useState, useRef, useCallback } from 'react';
import { SyncService, SyncStatus, SyncResult } from '../services/syncService';
import { useAuditOfflineStore } from '../store/useAuditOfflineStore';

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSyncAt: null,
    inProgress: false,
  });
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const serviceRef = useRef<SyncService | null>(null);
  const pendingSyncCount = useAuditOfflineStore((s) => s.pendingSyncCount);

  useEffect(() => {
    const service = new SyncService((newStatus) => {
      setStatus(newStatus);
    });
    serviceRef.current = service;
    service.startMonitoring();

    return () => {
      service.stopMonitoring();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    setStatus((prev) => ({ ...prev, pendingCount: pendingSyncCount }));
  }, [pendingSyncCount]);

  const syncNow = useCallback(async () => {
    if (!serviceRef.current) return;
    const result = await serviceRef.current.syncNow();
    setLastResult(result);
    return result;
  }, []);

  return {
    ...status,
    lastResult,
    syncNow,
  };
}
