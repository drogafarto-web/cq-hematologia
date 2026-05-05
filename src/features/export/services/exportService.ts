import { httpsCallable } from 'firebase/functions';
import { functions } from '../../core/firebase';
import { ExportRequest, ExportInitiateResponse } from '../types';

/**
 * Client-side export service
 * Works on both web and mobile (React Native)
 */
export const ExportService = {
  /**
   * Initiate export: call Cloud Callable to create job
   *
   * Usage:
   * const response = await ExportService.initiateExport({
   *   labId: 'lab-123',
   *   format: 'xlsx',
   *   startDate: new Date('2026-01-01'),
   *   endDate: new Date('2026-05-04'),
   * });
   * console.log(`Job ${response.jobId} will complete in ~${response.estimatedMinutes} minutes`);
   */
  initiateExport: async (
    request: ExportRequest
  ): Promise<ExportInitiateResponse> => {
    const callable = httpsCallable<
      ExportRequest,
      ExportInitiateResponse
    >(functions, 'initiateExport');

    try {
      const result = await callable(request);
      return result.data;
    } catch (error: any) {
      const message = error.message || 'Failed to initiate export';
      console.error('[Export] initiateExport error:', error);
      throw new Error(message);
    }
  },

  /**
   * Poll job status (for manual polling; hook is preferred)
   *
   * Usage:
   * const job = await ExportService.getJobStatus('lab-123', 'job-abc123');
   */
  getJobStatus: async (
    labId: string,
    jobId: string
  ): Promise<any> => {
    // Phase 3.2: implement a Cloud Callable to fetch job
    // For now, use Firestore directly (client-side read permission required)
    throw new Error('Implement in Phase 3.2');
  },
};
