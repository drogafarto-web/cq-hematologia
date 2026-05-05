/**
 * useScheduledExport — Hook for managing weekly export schedule configuration.
 *
 * Reads the /labs/{labId}/exportSchedule Firestore document (single doc per lab).
 * Provides local config state, updateConfig for field-level changes, and saveConfig
 * to persist to Firestore.
 *
 * Multi-tenant: all reads/writes scoped to /labs/{labId}/exportSchedule
 * RN-06 compliance: uses .set({ merge: true }) — never deleteDoc
 *
 * Path: /labs/{labId}/exportSchedule (document ID: 'config')
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { BatchExportFormat } from '../components/BatchFormatSelector';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportScheduleConfig {
  enabled: boolean;
  frequency: 'weekly';
  formats: BatchExportFormat[];
  emailRecipient?: string;
  lastRunAt?: Date | null;
}

const DEFAULT_CONFIG: ExportScheduleConfig = {
  enabled: false,
  frequency: 'weekly',
  formats: [],
  emailRecipient: '',
};

interface UseScheduledExportReturn {
  /** Current (local) config state */
  config: ExportScheduleConfig;
  /** Update one or more config fields locally (not yet saved) */
  updateConfig: (patch: Partial<ExportScheduleConfig>) => void;
  /** Persist config to Firestore */
  saveConfig: () => Promise<void>;
  /** True while save is in flight */
  isSaving: boolean;
  /** Error from last save attempt (null if none) */
  saveError: string | null;
  /** True briefly after a successful save */
  isSaved: boolean;
  /** Timestamp of the last scheduled run (null if never run) */
  lastRunAt: Date | null;
  /** True while loading from Firestore */
  isLoading: boolean;
}

// ── Firestore path ────────────────────────────────────────────────────────────

function scheduleDocRef(labId: string) {
  return doc(db, 'labs', labId, 'exportSchedule', 'config');
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useScheduledExport(labId: string): UseScheduledExportReturn {
  const [, setRemoteConfig] = useState<ExportScheduleConfig>(DEFAULT_CONFIG);
  const [localConfig, setLocalConfig] = useState<ExportScheduleConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  // Subscribe to the schedule config doc
  useEffect(() => {
    if (!labId) return;

    setIsLoading(true);
    const ref = scheduleDocRef(labId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const config: ExportScheduleConfig = {
            enabled: Boolean(data['enabled']),
            frequency: 'weekly',
            formats: (data['formats'] as BatchExportFormat[]) ?? [],
            emailRecipient: (data['emailRecipient'] as string) ?? '',
          };

          // Parse lastRunAt (Firestore Timestamp or null)
          const rawLastRun = data['lastRunAt'];
          if (rawLastRun && typeof rawLastRun === 'object' && 'toDate' in rawLastRun) {
            setLastRunAt((rawLastRun as { toDate: () => Date }).toDate());
          } else {
            setLastRunAt(null);
          }

          setRemoteConfig(config);
          setLocalConfig(config);
        } else {
          // Doc doesn't exist yet — use defaults
          setRemoteConfig(DEFAULT_CONFIG);
          setLocalConfig(DEFAULT_CONFIG);
          setLastRunAt(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('[ScheduledExport] onSnapshot error:', err);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId]);

  const updateConfig = useCallback((patch: Partial<ExportScheduleConfig>) => {
    setLocalConfig((prev) => ({ ...prev, ...patch }));
    // Clear saved indicator on any change
    setIsSaved(false);
    setSaveError(null);
  }, []);

  const saveConfig = useCallback(async () => {
    if (!labId) return;

    setIsSaving(true);
    setSaveError(null);
    setIsSaved(false);

    try {
      const ref = scheduleDocRef(labId);

      // Use setDoc with merge:true (RN-06 compliance — never deleteDoc)
      await setDoc(
        ref,
        {
          enabled: localConfig.enabled,
          frequency: 'weekly',
          formats: localConfig.formats,
          emailRecipient: localConfig.emailRecipient ?? null,
          labId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setIsSaved(true);

      // Clear the saved indicator after 3 seconds
      const timeout = setTimeout(() => setIsSaved(false), 3000);
      return () => clearTimeout(timeout);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao salvar configuração.';
      setSaveError(message);
      console.error('[ScheduledExport] saveConfig error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [labId, localConfig]);

  return {
    config: localConfig,
    updateConfig,
    saveConfig,
    isSaving,
    saveError,
    isSaved,
    lastRunAt,
    isLoading,
  };
}
