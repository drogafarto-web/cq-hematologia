/**
 * SupervisorStatusBootstrapVerifier.tsx
 * Real-time monitor of supervisor-status bootstrap state across all labs.
 *
 * Shows:
 * - Lab ID
 * - hasActiveSupervisor status (green dot if false, yellow if true)
 * - lastUpdated timestamp
 * - Action buttons (Force reset, Manual override)
 *
 * RDC 978 Art. 122 — Active supervisor presence enforcement.
 * Pre-deployment validation tool for Wave 4 Phase 10 (bootstrap verification).
 */

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  Query,
  DocumentData,
  Firestore,
  QueryConstraint,
} from 'firebase/firestore';
// import { db } from '@/lib/firebase';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { AlertCircle, RefreshCw, RotateCcw, Zap } from 'lucide-react';

// Stub for db since imports are commented
const db = {} as any;

export interface SupervisorStatusDoc {
  labId: string;
  hasActiveSupervisor: boolean;
  lastUpdated: Date;
}

/**
 * Real-time listener for supervisor-status docs across all labs.
 * Aggregates from /labs/{labId}/supervisor-status/current
 */
function useSupervisorStatusMonitor() {
  const [statuses, setStatuses] = useState<SupervisorStatusDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // First, fetch all labs
    const labsUnsubscribe = onSnapshot(
      collection(db, 'labs'),
      (labsSnapshot) => {
        const labs = labsSnapshot.docs.map((doc) => doc.id);

        // For each lab, subscribe to its supervisor-status/current doc
        labs.forEach((labId) => {
          const statusDocRef = collection(
            db,
            'labs',
            labId,
            'supervisor-status'
          );

          const statusUnsubscribe = onSnapshot(
            statusDocRef,
            (statusSnapshot) => {
              const currentDoc = statusSnapshot.docs.find((doc) => doc.id === 'current');

              setStatuses((prev) => {
                const filtered = prev.filter((s) => s.labId !== labId);

                if (currentDoc && currentDoc.exists()) {
                  const data = currentDoc.data();
                  return [
                    ...filtered,
                    {
                      labId,
                      hasActiveSupervisor: data.hasActiveSupervisor ?? false,
                      lastUpdated: data.lastUpdated?.toDate?.() || new Date(),
                    },
                  ];
                }

                return filtered;
              });
            },
            (err) => {
              setError(err);
            }
          );

          unsubscribers.push(statusUnsubscribe);
        });

        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    unsubscribers.push(labsUnsubscribe);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  return { statuses, loading, error };
}

/**
 * Status indicator badge
 */
function StatusBadge({ hasActiveSupervisor }: { hasActiveSupervisor: boolean }) {
  if (hasActiveSupervisor) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
        <span className="text-sm text-yellow-700 dark:text-yellow-300">
          Supervisor active
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
      <span className="text-sm text-emerald-700 dark:text-emerald-300">
        Ready (no supervisor)
      </span>
    </div>
  );
}

/**
 * Row for a single lab's supervisor status
 */
function SupervisorStatusRow({
  labId,
  hasActiveSupervisor,
  lastUpdated,
  onForceReset,
  onOverride,
}: {
  labId: string;
  hasActiveSupervisor: boolean;
  lastUpdated: Date;
  onForceReset: (labId: string) => void;
  onOverride: (labId: string, value: boolean) => void;
}) {
  const timeAgo = Math.round(
    (Date.now() - lastUpdated.getTime()) / 1000 / 60
  );
  const timeLabel =
    timeAgo < 1 ? 'now' : timeAgo === 1 ? '1 min' : `${timeAgo} mins`;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      {/* Lab ID + Status */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
          {labId}
        </div>
        <div className="mt-1">
          <StatusBadge hasActiveSupervisor={hasActiveSupervisor} />
        </div>
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0 px-4 text-xs text-gray-600 dark:text-gray-400">
        {lastUpdated.toLocaleTimeString()}
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
          {timeLabel} ago
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2">
        <button
          onClick={() => onForceReset(labId)}
          title="Reset to hasActiveSupervisor=false"
          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Reset
        </button>
        <button
          onClick={() => onOverride(labId, !hasActiveSupervisor)}
          title="Toggle supervisor status"
          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Toggle
        </button>
      </div>
    </div>
  );
}

/**
 * Main component: Verification grid
 */
export function SupervisorStatusBootstrapVerifier() {
  const { statuses, loading, error } = useSupervisorStatusMonitor();
  const [refreshing, setRefreshing] = useState(false);

  const handleForceReset = async (labId: string) => {
    try {
      setRefreshing(true);
      // Placeholder: In production, call a Cloud Function
      // await resetSupervisorStatus({ labId });
      console.log(`Force reset for ${labId}`);
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOverride = async (labId: string, value: boolean) => {
    try {
      setRefreshing(true);
      // Placeholder: In production, call a Cloud Function
      // await overrideSupervisorStatus({ labId, hasActiveSupervisor: value });
      console.log(`Override for ${labId} → ${value}`);
    } catch (err) {
      console.error('Override failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <span className="w-6 h-6 text-gray-400">⟳</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <span className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5">!</span>
        <div>
          <h3 className="font-semibold text-red-900 dark:text-red-100">
            Connection Error
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <p>No labs found. Run bootstrap-supervisor-status.mjs first.</p>
      </div>
    );
  }

  const allReady = statuses.every((s) => !s.hasActiveSupervisor);

  return (
    <div className="space-y-4">
      {/* Header + Status Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Supervisor Status Bootstrap Verification
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitor: {statuses.length} lab(s) · Pre-deployment validation
          </p>
        </div>
        {allReady && (
          <div className="px-3 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
            ✓ All ready
          </div>
        )}
      </div>

      {/* Status Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
              Labs
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Status
            </span>
          </div>
        </div>

        <div>
          {statuses.map((status) => (
            <SupervisorStatusRow
              key={status.labId}
              labId={status.labId}
              hasActiveSupervisor={status.hasActiveSupervisor}
              lastUpdated={status.lastUpdated}
              onForceReset={handleForceReset}
              onOverride={handleOverride}
            />
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p>
          <strong>RDC 978 Art. 122:</strong> Each lab's supervisor-status document gates CIQ run submissions. Bootstrap creates docs with hasActiveSupervisor=false (safe default).
        </p>
      </div>
    </div>
  );
}
