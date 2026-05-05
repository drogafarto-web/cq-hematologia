/**
 * Analytics Export Service — client-side
 *
 * Calls the generateDashboardPDF Cloud Function callable and polls the
 * export job document until completion or failure.
 *
 * Multi-tenant: labId scoped to authenticated user's lab.
 */

import { functions, httpsCallable, db, doc, getDoc } from '../../../shared/services/firebase';
import type { DateRange } from '../hooks/useDateRangeFilter';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardType = 'compliance' | 'ciq-trends' | 'nc-heatmap' | 'training-matrix';

export interface PDFExportParams {
  labId: string;
  dashboardType: DashboardType;
  dateRange: DateRange;
  filters?: {
    equipmentIds?: string[];
    operatorIds?: string[];
  };
}

export interface PDFExportResult {
  jobId: string;
  status: 'done';
  downloadUrl: string;
  fileSizeBytes: number;
}

export interface ExportJobDoc {
  jobId: string;
  status: 'processing' | 'done' | 'failed';
  downloadUrl?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
}

// ─── Callable reference ───────────────────────────────────────────────────────

const generateDashboardPDFCallable = httpsCallable<
  {
    labId: string;
    dashboardType: DashboardType;
    dateRange: { start: string; end: string };
    filters?: { equipmentIds?: string[]; operatorIds?: string[] };
  },
  PDFExportResult
>(functions, 'generateDashboardPDF');

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Initiates a dashboard PDF export via Cloud Function.
 * Returns the result directly (CF is synchronous for Phase 3.3).
 *
 * The CF handles job creation, Puppeteer rendering, Storage upload,
 * and signed URL generation in a single invocation.
 */
export async function initiateDashboardPDFExport(
  params: PDFExportParams,
): Promise<PDFExportResult> {
  const { labId, dashboardType, dateRange, filters } = params;

  const result = await generateDashboardPDFCallable({
    labId,
    dashboardType,
    dateRange: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    filters: filters
      ? {
          equipmentIds: filters.equipmentIds?.length ? filters.equipmentIds : undefined,
          operatorIds: filters.operatorIds?.length ? filters.operatorIds : undefined,
        }
      : undefined,
  });

  return result.data;
}

/**
 * Polls an export job document every 5s until status is 'done' or 'failed'.
 * Use this if the CF becomes async (Pub/Sub pattern) in a future phase.
 *
 * @param labId    Lab identifier
 * @param jobId    Job document ID
 * @param maxWaitMs Maximum time to wait (default 5 minutes)
 * @returns Resolved job data when status = 'done'
 * @throws Error when status = 'failed' or timeout exceeded
 */
export async function pollExportJob(
  labId: string,
  jobId: string,
  maxWaitMs = 5 * 60 * 1000,
): Promise<ExportJobDoc> {
  const POLL_INTERVAL_MS = 5_000;
  const deadline = Date.now() + maxWaitMs;

  const jobRef = doc(db, 'labs', labId, 'export-jobs', jobId);

  while (Date.now() < deadline) {
    const snap = await getDoc(jobRef);
    if (!snap.exists()) {
      throw new Error(`Export job ${jobId} not found`);
    }

    const data = snap.data() as ExportJobDoc;

    if (data.status === 'done') {
      return data;
    }

    if (data.status === 'failed') {
      throw new Error(data.errorMessage ?? 'Export job failed');
    }

    // status = 'processing' — wait and poll again
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Export job timed out');
}
