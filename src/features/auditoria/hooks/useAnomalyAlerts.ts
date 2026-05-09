/**
 * Hook: useAnomalyAlerts — Subscribe to anomaly alerts with filtering
 *
 * Fetches anomaly alerts from /labs/{labId}/anomaly-alerts with optional
 * severity and date-range filtering. Uses onSnapshot for real-time updates.
 *
 * RDC 978 5.3 + DICQ 4.4 — audit trail anomalies with who/what/when/where context.
 */

import { useEffect, useState } from 'react';
import { onSnapshot, query, where, orderBy, collectionGroup, db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyAlert {
  id: string;
  labId: string;
  severity: AlertSeverity;
  scope: string; // e.g. "CIQ-Bioquímica", "CEQ", "Calibração"
  shortDescription: string;
  patternSummary: string;
  recommendations: string[];
  detectedAt: number; // ms epoch
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
}

export interface AnomalyAlertsState {
  alerts: AnomalyAlert[];
  loading: boolean;
  error: Error | null;
}

export interface AnomalyAlertsFilterOptions {
  severity?: AlertSeverity | AlertSeverity[];
  from?: number; // ms epoch
  to?: number;   // ms epoch
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAnomalyAlerts(
  labId: string,
  filters?: AnomalyAlertsFilterOptions,
): AnomalyAlertsState {
  const [state, setState] = useState<AnomalyAlertsState>({
    alerts: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!labId) {
      setState({ alerts: [], loading: false, error: null });
      return;
    }

    // Build where clause array
    const whereConditions: Parameters<typeof where>[] = [
      ['labId', '==', labId] as const,
    ];

    // Severity filter (single or multiple)
    if (filters?.severity) {
      const severities = Array.isArray(filters.severity)
        ? filters.severity
        : [filters.severity];
      if (severities.length > 0) {
        whereConditions.push(['severity', 'in', severities] as const);
      }
    }

    // Date-range filter
    if (filters?.from !== undefined) {
      whereConditions.push(['detectedAt', '>=', filters.from] as const);
    }
    if (filters?.to !== undefined) {
      whereConditions.push(['detectedAt', '<=', filters.to] as const);
    }

    // Build query with where + orderBy
    const constraints = [
      ...whereConditions.map(([field, op, value]) => where(field as string, op as any, value)),
      orderBy('detectedAt', 'desc'),
    ];

    const alertsRef = collectionGroup(db, 'anomaly-alerts');
    const alertsQuery = query(alertsRef, ...constraints);

    // Subscribe
    const unsubscribe = onSnapshot(
      alertsQuery,
      (snap) => {
        const alerts: AnomalyAlert[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          alerts.push({
            id: doc.id,
            labId: data.labId,
            severity: data.severity,
            scope: data.scope,
            shortDescription: data.shortDescription,
            patternSummary: data.patternSummary,
            recommendations: data.recommendations ?? [],
            detectedAt: data.detectedAt,
            acknowledgedAt: data.acknowledgedAt ?? null,
            acknowledgedBy: data.acknowledgedBy ?? null,
          });
        });

        setState({
          alerts,
          loading: false,
          error: null,
        });
      },
      (error) => {
        console.error('[useAnomalyAlerts] subscription error:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      },
    );

    return () => {
      unsubscribe();
    };
  }, [labId, filters?.severity, filters?.from, filters?.to]);

  return state;
}
