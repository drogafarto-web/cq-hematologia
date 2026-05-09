/**
 * useAnomalyAlerts.ts
 *
 * React hook for real-time anomaly alerts dashboard.
 * Subscribes to /labs/{labId}/audit-alerts collection filtered by status='active'.
 *
 * Phase 7 Wave 3: Advanced Auditoria
 * RDC 978 Art. 107 — Anomalies in operation audit trail
 * DICQ 4.4 — Audit monitoring + compliance tracking
 *
 * Features:
 * - Real-time subscription via onSnapshot
 * - Severity filtering
 * - Dismiss action via callable
 * - Cleanup on unmount
 */

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import type { AuditAlert } from '../types/anomalyTypes';
import type { LabId } from '../types/shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseAnomalyAlertsReturn {
  alerts: AuditAlert[];
  loading: boolean;
  error: string | null;
  dismissAlert: (alertId: string, reason: string) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnomalyAlerts(labId: LabId): UseAnomalyAlertsReturn {
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to active alerts
  useEffect(() => {
    if (!labId) {
      setError('Lab ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query: /labs/{labId}/audit-alerts where status='active'
      const alertsRef = collection(db, 'labs', labId, 'audit-alerts');
      const q = query(
        alertsRef,
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(50),
      ) as Query<AuditAlert>;

      // Subscribe
      const unsubscribe: Unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data: AuditAlert[] = [];
          snapshot.forEach((doc) => {
            const docData = doc.data();
            data.push({
              ...docData,
              id: doc.id,
            });
          });
          setAlerts(data);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[useAnomalyAlerts] Subscription error', err);
          setError(err instanceof Error ? err.message : 'Failed to load alerts');
          setLoading(false);
        },
      );

      // Cleanup on unmount
      return () => {
        unsubscribe();
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      console.error('[useAnomalyAlerts] Setup error', err);
      setError(msg);
      setLoading(false);
    }
  }, [labId]);

  // Dismiss alert via callable
  const dismissAlert = useCallback(
    async (alertId: string, reason: string) => {
      if (!labId) {
        throw new Error('Lab ID is required');
      }

      try {
        const callable = httpsCallable(functions, 'dismissAuditAlert');
        await callable({
          labId,
          alertId,
          reason,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to dismiss alert';
        console.error('[useAnomalyAlerts] Dismiss error', err);
        throw new Error(msg);
      }
    },
    [labId],
  );

  return { alerts, loading, error, dismissAlert };
}
