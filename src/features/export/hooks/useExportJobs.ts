import { useEffect, useState } from 'react';
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { ExportJob } from '../types';

/**
 * Hook: Subscribe to export job status
 *
 * Usage:
 * const { job, loading, error } = useExportJob(labId, jobId);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage message={error} />;
 * if (job?.status === 'completed') return <DownloadButton url={job.downloadUrl} />;
 * if (job?.status === 'processing') return <ProgressBar />;
 * if (job?.status === 'failed') return <RetryButton />;
 */
export function useExportJob(
  labId: string,
  jobId: string
): {
  job: ExportJob | null;
  loading: boolean;
  error: string | null;
} {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !jobId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const jobRef = doc(
      db,
      'labs',
      labId,
      'export-jobs',
      jobId
    );

    const unsubscribe = onSnapshot(
      jobRef,
      (snap: DocumentSnapshot) => {
        if (snap.exists()) {
          const data = snap.data() as ExportJob;
          // Convert Firestore Timestamps to Dates
          if (data.createdAt && typeof data.createdAt !== 'number') {
            data.createdAt = new Date(data.createdAt as any);
          }
          if (data.expiresAt && typeof data.expiresAt !== 'number') {
            data.expiresAt = new Date(data.expiresAt as any);
          }
          setJob(data);
        } else {
          setError('Job not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('[Export] Error loading job:', err);
        setError(err.message || 'Failed to load job');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [labId, jobId]);

  return { job, loading, error };
}

/**
 * Helper: Check if signed URL is about to expire
 * (warn user if <1 day left)
 */
export function isDownloadExpiringsome(job: ExportJob | null): boolean {
  if (!job?.expiresAt) return false;
  const timeLeft = job.expiresAt.getTime() - Date.now();
  return timeLeft < 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Helper: Format file size for display
 * 1234567 → "1.2 MB"
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Helper: Format processing duration
 * 12345 → "12s", 125000 → "2m 5s"
 */
export function formatDuration(ms: number | undefined): string {
  if (!ms) return 'Calculating...';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
