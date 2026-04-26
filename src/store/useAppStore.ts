import { create } from 'zustand';
import type { ControlLot, SyncStatus, PendingRun, PendingBulaData, View } from '../types';

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
  /**
   * Última view antes da atual — alimenta botão "← Voltar" pra retornar
   * ao contexto de origem em vez de hard-coded 'hub'. Atualizado por
   * `setCurrentView` automaticamente. Ver `goBack` abaixo.
   */
  previousView: View | null;
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
  /** Volta pra previousView. Fallback 'hub' se não há histórico. */
  goBack: () => void;
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
  currentView: 'hub' as View,
  previousView: null as View | null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setLots: (lots) => set({ lots }),
  setActiveLotId: (activeLotId) => set({ activeLotId }),
  setSelectedAnalyteId: (selectedAnalyteId) => set({ selectedAnalyteId }),
  setPendingRun: (pendingRun) => set({ pendingRun }),
  setPendingBulaData: (pendingBulaData) => set({ pendingBulaData }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  // Atualiza previousView com a current ANTES de mudar, exceto se for
  // navegação pra mesma view (no-op) ou pra previousView (back trip).
  setCurrentView: (currentView) => {
    const { currentView: prev, previousView } = get();
    if (currentView === prev) return; // no-op
    // Se a próxima view é justamente a previousView, é um "back" — limpa o
    // previousView pra evitar loop A→B→A→B infinito.
    if (currentView === previousView) {
      set({ currentView, previousView: null });
      return;
    }
    set({ currentView, previousView: prev });
  },
  goBack: () => {
    const { previousView } = get();
    set({ currentView: previousView ?? 'hub', previousView: null });
  },
  reset: () => set(initialState),
}));

// ─── Atomic selectors ─────────────────────────────────────────────────────────

export const useActiveLot = () =>
  useAppStore((s) => s.lots.find((l) => l.id === s.activeLotId) ?? null);

export const useSyncStatus = () => useAppStore((s) => s.syncStatus);
export const useCurrentView = () => useAppStore((s) => s.currentView);
export const usePendingRun = () => useAppStore((s) => s.pendingRun);
export const useAppIsLoading = () => useAppStore((s) => s.isLoading);
export const useAppError = () => useAppStore((s) => s.error);
export const useLots = () => useAppStore((s) => s.lots);
export const useActiveLotId = () => useAppStore((s) => s.activeLotId);
export const useSelectedAnalyteId = () => useAppStore((s) => s.selectedAnalyteId);
