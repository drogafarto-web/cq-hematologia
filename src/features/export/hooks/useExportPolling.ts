/**
 * Hook: useExportPolling
 * Interval-based job status polling for cases where real-time Firestore subscription
 * is not ideal (e.g., polling a list of jobs without individual subscriptions).
 *
 * For single-job tracking, prefer useExportJob (onSnapshot-based).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { ExportJob } from '../types';

const DEFAULT_INTERVAL_MS = 5_000; // 5 seconds

interface UseExportPollingOptions {
  labId: string;
  jobId: string;
  /** Polling interval in ms (default: 5000) */
  intervalMs?: number;
  /** Stop polling when true (e.g., job reached terminal state) */
  disabled?: boolean;
}

interface UseExportPollingReturn {
  job: ExportJob | null;
  loading: boolean;
  error: string | null;
  /** Immediately re-fetch without waiting for next interval */
  refresh: () => Promise<void>;
}

function isTerminalStatus(job: ExportJob | null): boolean {
  return job?.status === 'completed' || job?.status === 'failed';
}

export function useExportPolling({
  labId,
  jobId,
  intervalMs = DEFAULT_INTERVAL_MS,
  disabled = false,
}: UseExportPollingOptions): UseExportPollingReturn {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchJob = useCallback(async () => {
    if (!labId || !jobId) return;

    try {
      const ref = doc(db, 'labs', labId, 'export-jobs', jobId);
      const snap = await getDoc(ref);

      if (!mountedRef.current) return;

      if (snap.exists()) {
        const data = snap.data() as ExportJob;
        // Coerce Firestore Timestamps
        const coerced: ExportJob = {
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt as unknown as string) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt as unknown as string) : new Date(),
          startDate: data.startDate ? new Date(data.startDate as unknown as string) : new Date(),
          endDate: data.endDate ? new Date(data.endDate as unknown as string) : new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt as unknown as string) : undefined,
          generatedAt: data.generatedAt
            ? new Date(data.generatedAt as unknown as string)
            : undefined,
          startedAt: data.startedAt ? new Date(data.startedAt as unknown as string) : undefined,
          completedAt: data.completedAt
            ? new Date(data.completedAt as unknown as string)
            : undefined,
        };
        setJob(coerced);
        setError(null);
      } else {
        setError('Job não encontrado');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Falha ao buscar status';
      setError(message);
      console.error('[Export] Polling error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [labId, jobId]);

  // Initial fetch
  useEffect(() => {
    if (!disabled) {
      setLoading(true);
      fetchJob();
    }
  }, [fetchJob, disabled]);

  // Interval polling — stops when job reaches terminal state
  useEffect(() => {
    if (disabled || isTerminalStatus(job)) return;

    const timer = setInterval(() => {
      fetchJob();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fetchJob, intervalMs, disabled, job]);

  return { job, loading, error, refresh: fetchJob };
}
