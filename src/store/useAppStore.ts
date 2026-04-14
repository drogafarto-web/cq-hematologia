import { create } from 'zustand';
import type { ControlLot, SyncStatus, PendingRun, PendingBulaData, View, StatsSource } from '../types';

interface AppState {
  lots: ControlLot[];
  activeLotId: string | null;
  selectedAnalyteId: string | null;
  pendingRun: PendingRun | null;
  pendingBulaData: PendingBulaData | null;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  currentView: View;
  chartStatsSource: StatsSource;

  // Actions
  setLots: (lots: ControlLot[]) => void;
  setActiveLotId: (id: string | null) => void;
  setSelectedAnalyteId: (id: string | null) => void;
  setPendingRun: (run: PendingRun | null) => void;
  setPendingBulaData: (data: PendingBulaData | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSyncStatus: (s: SyncStatus) => void;
  setCurrentView: (v: View) => void;
  setChartStatsSource: (s: StatsSource) => void;
  reset: () => void;
}

const initialState = {
  lots: [],
  activeLotId: null,
  selectedAnalyteId: null,
  pendingRun: null,
  pendingBulaData: null,
  isLoading: false,
  error: null,
  syncStatus: 'saved' as SyncStatus,
  currentView: 'analyzer' as View,
  chartStatsSource: 'manufacturer' as StatsSource,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setLots:              (lots)              => set({ lots }),
  setActiveLotId:       (activeLotId)       => set({ activeLotId }),
  setSelectedAnalyteId: (selectedAnalyteId) => set({ selectedAnalyteId }),
  setPendingRun:        (pendingRun)        => set({ pendingRun }),
  setPendingBulaData:   (pendingBulaData)   => set({ pendingBulaData }),
  setLoading:           (isLoading)         => set({ isLoading }),
  setError:             (error)             => set({ error }),
  setSyncStatus:        (syncStatus)        => set({ syncStatus }),
  setCurrentView:       (currentView)       => set({ currentView }),
  setChartStatsSource:  (chartStatsSource)  => set({ chartStatsSource }),

  reset: () => set(initialState),
}));

// ─── Atomic selectors ─────────────────────────────────────────────────────────

export const useActiveLot = () =>
  useAppStore((s) => s.lots.find((l) => l.id === s.activeLotId) ?? null);

export const useSyncStatus      = () => useAppStore((s) => s.syncStatus);
export const useCurrentView     = () => useAppStore((s) => s.currentView);
export const useChartStatsSource = () => useAppStore((s) => s.chartStatsSource);
export const usePendingRun      = () => useAppStore((s) => s.pendingRun);
export const useAppIsLoading    = () => useAppStore((s) => s.isLoading);
export const useAppError        = () => useAppStore((s) => s.error);
export const useLots            = () => useAppStore((s) => s.lots);
export const useActiveLotId     = () => useAppStore((s) => s.activeLotId);
export const useSelectedAnalyteId = () => useAppStore((s) => s.selectedAnalyteId);
