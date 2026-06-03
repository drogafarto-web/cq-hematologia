/**
 * useDueDateMonitor.ts
 *
 * Monitors due date status changes with meta-diff guard.
 * Polls every 3600 seconds (1 hour) for local deadline recomputation.
 *
 * Does NOT fetch new data from Firestore — only recomputes derived fields
 * from existing calibracoes to detect threshold crossings (30/15/7 days).
 */

import { useEffect, useRef, useState } from 'react';
import type { CalibracaoRecord } from '../types/index';

export interface DueDateChange {
  equipId: string;
  previousStatus: string;
  newStatus: string;
  daysRemaining: number;
}

export interface UseDueDateMonitorResult {
  changes: DueDateChange[];
  lastCheck: Date | null;
}

/**
 * Default: 1 hour (3600 seconds). Set to lower values for testing.
 */
const DEFAULT_POLL_INTERVAL_MS = 3600 * 1000; // 1 hour

export function useDueDateMonitor(
  calibracoes: CalibracaoRecord[],
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UseDueDateMonitorResult {
  const [changes, setChanges] = useState<DueDateChange[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const previousStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Initial state: store baseline
    previousStatusRef.current.clear();
    calibracoes.forEach((cal) => {
      previousStatusRef.current.set(cal.id, cal.dueDateInfo.status);
    });
  }, [calibracoes]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Meta-diff: check if any status changed
      const detectedChanges: DueDateChange[] = [];

      calibracoes.forEach((cal) => {
        const previousStatus = previousStatusRef.current.get(cal.id);
        const currentStatus = cal.dueDateInfo.status;

        if (previousStatus !== currentStatus) {
          detectedChanges.push({
            equipId: cal.equipId,
            previousStatus: previousStatus || 'unknown',
            newStatus: currentStatus,
            daysRemaining: cal.dueDateInfo.daysUntilDue,
          });

          // Update stored status
          previousStatusRef.current.set(cal.id, currentStatus);
        }
      });

      if (detectedChanges.length > 0) {
        setChanges(detectedChanges);
        setLastCheck(new Date());

        // Log alert threshold crossings
        detectedChanges.forEach((change) => {
          if (change.daysRemaining === 30) {
            console.info(`[Calibração] 30-day alert: ${change.equipId} entering at-risk zone`);
          } else if (change.daysRemaining === 7) {
            console.info(`[Calibração] 7-day alert: ${change.equipId} entering critical zone`);
          } else if (change.daysRemaining === 0) {
            console.warn(`[Calibração] OVERDUE: ${change.equipId} has passed due date`);
          }
        });
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [calibracoes, pollIntervalMs]);

  return { changes, lastCheck };
}
