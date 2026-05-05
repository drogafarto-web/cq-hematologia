/**
 * Export feature — Type definitions
 * Shared between client and Cloud Functions
 */

/**
 * Export format options (Phase 3.1: XLSX only)
 */
export type ExportFormat = 'xlsx' | 'pdf' | 'csv'; // csv + pdf are Phase 3.2

/**
 * Export job status lifecycle
 */
export type ExportJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Client request to initiate export
 */
export interface ExportRequest {
  labId: string;
  format: ExportFormat;
  startDate: string | Date; // ISO string or Date; CF will parse
  endDate: string | Date;
  operatorId?: string; // For audit trail (optional; Cloud CF can extract from auth)
  /** Optional: email to receive the signed URL when job completes (Phase 3.3) */
  emailRecipient?: string;
}

/**
 * Cloud Function response when export is initiated
 */
export interface ExportInitiateResponse {
  jobId: string;
  status: 'queued';
  estimatedMinutes: number;
  createdAt: string; // ISO timestamp
}

/**
 * Export job document stored in Firestore
 * Path: /labs/{labId}/export-jobs/{jobId}
 */
export interface ExportJob {
  jobId: string;
  labId: string;
  format: ExportFormat;
  startDate: Date;
  endDate: Date;
  status: ExportJobStatus;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  operatorId: string; // User who initiated
  estimatedSizeBytes?: number;

  // Result (populated when status='completed')
  downloadUrl?: string;
  expiresAt?: Date;
  fileSizeBytes?: number;
  generatedAt?: Date;

  // Error (if status='failed')
  errorMessage?: string;

  // Processing info
  startedAt?: Date;
  completedAt?: Date;
  processingDurationMs?: number;
}

/**
 * Pub/Sub message body for export job processing
 */
export interface ExportJobMessage {
  jobId: string;
  labId: string;
  format: ExportFormat;
}

/**
 * Return type from export worker Cloud Function
 */
export interface ExportWorkerResult {
  jobId: string;
  status: 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  fileSizeBytes?: number;
  error?: string;
  processingDurationMs: number;
}
