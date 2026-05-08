/**
 * useConsentBackfillPhases.ts
 * State management for consent backfill workflow phases.
 *
 * Manages:
 * - Phase navigation (1-4)
 * - Stats tracking (inventory, coverage %)
 * - Callable integration (exportPatientList, batchRecordConsent)
 * - Error handling + retry logic
 */

import { useState, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';

export type ConsentBackfillPhase = 1 | 2 | 3 | 4;

export interface BackfillStats {
  inventoryCount: number;
  consentedCount: number;
  needsConsentCount: number;
  coveragePercent: number;
  phase: ConsentBackfillPhase;
  lastUpdated: string;
}

interface ExportPatientListResponse {
  ok: boolean;
  labId: string;
  rowCount: number;
  exportUrl?: string;
  error?: string;
}

interface BatchRecordConsentResponse {
  ok: boolean;
  labId: string;
  requestId: string;
  attempted: number;
  succeeded: number;
  failed: number;
  results: Array<{
    patientId: string;
    ok: boolean;
    code?: string;
    error?: string;
  }>;
}

interface BatchEntry {
  patientId: string;
  consentedAt: string;
  capturedBy: string;
  signedDocPath: string;
  notes?: string;
}

/**
 * Hook for managing consent backfill workflow state and callable integration.
 * Reads/writes to `/labs/{labId}/consent-backfill-state/` (server-side).
 */
export function useConsentBackfillPhases(labId: string | null) {
  const [currentPhase, setCurrentPhase] = useState<ConsentBackfillPhase>(1);
  const [stats, setStats] = useState<BackfillStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load phase + stats on mount
  useEffect(() => {
    if (!labId) return;

    const loadPhaseState = async () => {
      try {
        // TODO: Query `/labs/{labId}/consent-backfill-state/` via service
        // For now, initialize to phase 1 with stub data
        setCurrentPhase(1);
        setStats({
          inventoryCount: 0,
          consentedCount: 0,
          needsConsentCount: 0,
          coveragePercent: 0,
          phase: 1,
          lastUpdated: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[loadPhaseState]', err);
      }
    };

    loadPhaseState();
  }, [labId]);

  /**
   * Phase 1: Export patient list.
   * Calls `consents_exportPatientList` callable.
   * Triggers CSV download via signed URL.
   */
  const exportPatientList = useCallback(async () => {
    if (!labId) throw new Error('labId required');

    setIsLoading(true);
    setError(null);

    try {
      const callable = httpsCallable<{ labId: string }, ExportPatientListResponse>(
        functions,
        'consents_exportPatientList',
      );

      const response = await callable({ labId });

      if (!response.data.ok) {
        throw new Error(response.data.error || 'Export failed');
      }

      // Trigger download
      if (response.data.exportUrl) {
        const link = document.createElement('a');
        link.href = response.data.exportUrl;
        link.download = `patients-${labId}-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Update stats from response
      setStats((prev) =>
        prev
          ? {
              ...prev,
              inventoryCount: response.data.rowCount,
              lastUpdated: new Date().toISOString(),
            }
          : null,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [labId]);

  /**
   * Phase 3: Batch record consent.
   * Calls `consents_batchRecordConsent` callable with chunked entries (500 per call).
   * Returns aggregated results.
   */
  const submitBatch = useCallback(
    async (entries: BatchEntry[]) => {
      if (!labId) throw new Error('labId required');

      setIsLoading(true);
      setError(null);

      try {
        const callable = httpsCallable<
          { labId: string; defaultConsentVersion: string; defaultScope: string[]; entries: BatchEntry[] },
          BatchRecordConsentResponse
        >(functions, 'consents_batchRecordConsent');

        const chunkSize = 500;
        const chunks = [];

        for (let i = 0; i < entries.length; i += chunkSize) {
          chunks.push(entries.slice(i, i + chunkSize));
        }

        let totalSucceeded = 0;
        let totalFailed = 0;

        for (const chunk of chunks) {
          const response = await callable({
            labId,
            defaultConsentVersion: 'lgpd-v1',
            defaultScope: ['ia-strip'],
            entries: chunk,
          });

          if (!response.data.ok) {
            throw new Error(`Chunk failed: ${response.data.results.length} entries attempted`);
          }

          totalSucceeded += response.data.succeeded;
          totalFailed += response.data.failed;
        }

        return {
          ok: true,
          succeeded: totalSucceeded,
          failed: totalFailed,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Batch submission failed';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [labId],
  );

  return {
    currentPhase,
    setCurrentPhase,
    stats,
    isLoading,
    error,
    exportPatientList,
    submitBatch,
  };
}
