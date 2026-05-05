/**
 * useBatchExport — Hook for managing batch export state and execution.
 *
 * Manages:
 * - Format selection (Set<BatchExportFormat> with toggle)
 * - Batch export initiation via batchExport Cloud Callable
 * - Per-job status watching via onSnapshot for all returned jobIds
 * - Aggregate status (allComplete, anyFailed)
 *
 * Usage:
 *   const { selectedFormats, toggleFormat, initiateBatch, jobStatuses, allComplete } =
 *     useBatchExport(labId);
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { functions } from '../../../config/firebase.config';
import { db } from '../../../shared/services/firebase';
import type { BatchExportFormat } from '../components/BatchFormatSelector';
import type { ExportJob } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatchExportRequest {
  labId: string;
  formats: BatchExportFormat[];
  dateRange: { start: string; end: string };
  emailRecipient?: string;
}

interface BatchExportResponse {
  jobIds: string[];
  batchId: string;
}

export interface JobStatus {
  jobId: string;
  /** 'loading' = not yet fetched from Firestore */
  status: ExportJob['status'] | 'loading';
  downloadUrl?: string;
  errorMessage?: string;
}

interface UseBatchExportReturn {
  /** Currently selected formats */
  selectedFormats: Set<BatchExportFormat>;
  /** Toggle a format on/off */
  toggleFormat: (format: BatchExportFormat) => void;
  /** Initiate batch export — returns jobIds from CF */
  initiateBatch: (params: {
    labId: string;
    dateRange: { start: string; end: string };
    emailRecipient?: string;
  }) => Promise<BatchExportResponse>;
  /** Per-job status array */
  jobStatuses: JobStatus[];
  /** True when all jobs have reached 'completed' or 'failed' */
  allComplete: boolean;
  /** True if any job has failed */
  anyFailed: boolean;
  /** Loading state for the callable */
  loading: boolean;
  /** Error from the callable (null if none) */
  error: string | null;
  /** Reset state to initial */
  reset: () => void;
}

// ── Cloud callable ref ────────────────────────────────────────────────────────

const batchExportCallable = httpsCallable<BatchExportRequest, BatchExportResponse>(
  functions,
  'batchExport',
);

// ── Terminal status check ──────────────────────────────────────────────────────

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed';
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBatchExport(labId: string): UseBatchExportReturn {
  const [selectedFormats, setSelectedFormats] = useState<Set<BatchExportFormat>>(new Set());
  const [watchedJobIds, setWatchedJobIds] = useState<string[]>([]);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup ref for Firestore unsubscribers
  const unsubscribersRef = useRef<(() => void)[]>([]);

  // When watchedJobIds changes, set up onSnapshot listeners for each job
  useEffect(() => {
    // Clean up previous listeners
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];

    if (watchedJobIds.length === 0) {
      setJobStatuses([]);
      return;
    }

    // Initialize all statuses as 'loading'
    setJobStatuses(watchedJobIds.map((jobId) => ({ jobId, status: 'loading' })));

    const unsubs = watchedJobIds.map((jobId) => {
      const jobRef = doc(db, 'labs', labId, 'export-jobs', jobId);

      return onSnapshot(
        jobRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as ExportJob;
            setJobStatuses((prev) =>
              prev.map((j) =>
                j.jobId === jobId
                  ? {
                      jobId,
                      status: data.status,
                      downloadUrl: data.downloadUrl,
                      errorMessage: data.errorMessage,
                    }
                  : j,
              ),
            );
          }
        },
        (err) => {
          console.error(`[BatchExport] onSnapshot error for job ${jobId}:`, err);
        },
      );
    });

    unsubscribersRef.current = unsubs;

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [watchedJobIds, labId]);

  const toggleFormat = useCallback((format: BatchExportFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  }, []);

  const initiateBatch = useCallback(
    async (params: {
      labId: string;
      dateRange: { start: string; end: string };
      emailRecipient?: string;
    }): Promise<BatchExportResponse> => {
      if (selectedFormats.size === 0) {
        throw new Error('Selecione pelo menos um formato para exportar.');
      }

      setLoading(true);
      setError(null);

      try {
        const result = await batchExportCallable({
          labId: params.labId,
          formats: Array.from(selectedFormats),
          dateRange: params.dateRange,
          emailRecipient: params.emailRecipient,
        });

        const response = result.data;
        // Start watching all returned job IDs
        setWatchedJobIds(response.jobIds);
        return response;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Falha ao iniciar exportação em lote. Tente novamente.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [selectedFormats],
  );

  // Derived state
  const allComplete =
    watchedJobIds.length > 0 &&
    jobStatuses.length === watchedJobIds.length &&
    jobStatuses.every((j) => isTerminal(j.status));

  const anyFailed = jobStatuses.some((j) => j.status === 'failed');

  const reset = useCallback(() => {
    setSelectedFormats(new Set());
    setWatchedJobIds([]);
    setJobStatuses([]);
    setLoading(false);
    setError(null);
  }, []);

  return {
    selectedFormats,
    toggleFormat,
    initiateBatch,
    jobStatuses,
    allComplete,
    anyFailed,
    loading,
    error,
    reset,
  };
}
