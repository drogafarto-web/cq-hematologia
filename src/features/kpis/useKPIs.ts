import { useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { subscribeLatestKPI, subscribeKPIHistory, subscribeActiveAlerts } from './kpisService';
import type { KPIDaily, KPIAlert } from './types/KPI';

/**
 * Hook para acessar dados de KPIs em tempo real.
 */
export function useKPIs() {
  const { activeLabId: labId } = useAuthStore();

  const subscribeToLatestKPI = useCallback(
    (callback: (kpi: KPIDaily | null) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeLatestKPI(labId, callback, onError);
    },
    [labId]
  );

  const subscribeToKPIHistory = useCallback(
    (days: number = 30, callback?: (kpis: KPIDaily[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeKPIHistory(labId, days, callback, onError);
    },
    [labId]
  );

  const subscribeToAlerts = useCallback(
    (callback?: (alerts: KPIAlert[]) => void, onError?: (err: Error) => void) => {
      if (!labId) return () => {};
      return subscribeActiveAlerts(labId, callback, onError);
    },
    [labId]
  );

  return {
    subscribeToLatestKPI,
    subscribeToKPIHistory,
    subscribeToAlerts,
  };
}
