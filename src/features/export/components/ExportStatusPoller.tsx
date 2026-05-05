/**
 * ExportStatusPoller — Polls job status on interval and surfaces status to parent via callback.
 * Headless component (renders nothing itself). Used when real-time subscription is not needed.
 * Stops polling automatically when job reaches a terminal state (completed | failed).
 */

import { useEffect, useCallback } from 'react';
import { useExportPolling } from '../hooks/useExportPolling';
import type { ExportJob } from '../types';

interface ExportStatusPollerProps {
  labId: string;
  jobId: string;
  /** Interval in ms between polls (default: 5000) */
  intervalMs?: number;
  /** Called with updated job on each successful poll */
  onUpdate?: (job: ExportJob) => void;
  /** Called on poll error */
  onError?: (error: string) => void;
}

export function ExportStatusPoller({
  labId,
  jobId,
  intervalMs = 5_000,
  onUpdate,
  onError,
}: ExportStatusPollerProps) {
  const { job, error } = useExportPolling({ labId, jobId, intervalMs });

  const stableOnUpdate = onUpdate;
  const stableOnError = onError;

  useEffect(() => {
    if (job && stableOnUpdate) {
      stableOnUpdate(job);
    }
  }, [job, stableOnUpdate]);

  useEffect(() => {
    if (error && stableOnError) {
      stableOnError(error);
    }
  }, [error, stableOnError]);

  // This is a headless component — renders nothing
  return null;
}
