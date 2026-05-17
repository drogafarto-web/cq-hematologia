import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChecklistResponse {
  itemId: string;
  resposta: 'conforme' | 'nao-conforme' | 'N/A' | null;
  severidade?: string;
  observacao?: string;
  timestamp: number;
  synced: boolean;
}

export interface OfflineAchado {
  id: string;
  itemId: string;
  descricao: string;
  severidade: string;
  evidencias: OfflineEvidence[];
  timestamp: number;
  synced: boolean;
}

export interface OfflineEvidence {
  id: string;
  tipo: 'foto' | 'audio' | 'documento';
  localUri: string;
  uploadedUrl?: string;
  timestamp: number;
  synced: boolean;
}

interface AuditOfflineState {
  currentSessionId: string | null;
  currentAuditoriaId: string | null;
  labId: string | null;
  responses: Record<string, ChecklistResponse>;
  achados: OfflineAchado[];
  evidences: OfflineEvidence[];
  pendingSyncCount: number;
  lastSyncAt: number | null;
  syncInProgress: boolean;
  syncErrors: string[];

  setCurrentSession: (sessionId: string, auditoriaId: string, labId: string) => void;
  saveResponse: (itemId: string, data: { resposta: ChecklistResponse['resposta']; severidade?: string; observacao?: string }) => void;
  addAchado: (achado: Omit<OfflineAchado, 'id' | 'timestamp' | 'synced'>) => void;
  addEvidence: (evidence: Omit<OfflineEvidence, 'id' | 'timestamp' | 'synced'>) => void;
  markResponseSynced: (itemId: string) => void;
  markAchadoSynced: (achadoId: string) => void;
  markEvidenceSynced: (evidenceId: string) => void;
  setSyncInProgress: (value: boolean) => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;
  setLastSyncAt: (timestamp: number) => void;
  clearSession: () => void;
  getPendingItems: () => { responses: ChecklistResponse[]; achados: OfflineAchado[]; evidences: OfflineEvidence[] };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export const useAuditOfflineStore = create<AuditOfflineState>()(
  persist(
    (set, get) => ({
      currentSessionId: null,
      currentAuditoriaId: null,
      labId: null,
      responses: {},
      achados: [],
      evidences: [],
      pendingSyncCount: 0,
      lastSyncAt: null,
      syncInProgress: false,
      syncErrors: [],

      setCurrentSession: (sessionId, auditoriaId, labId) =>
        set({ currentSessionId: sessionId, currentAuditoriaId: auditoriaId, labId }),

      saveResponse: (itemId, data) =>
        set((state) => {
          const responses = {
            ...state.responses,
            [itemId]: { itemId, ...data, timestamp: Date.now(), synced: false },
          };
          const pendingSyncCount = Object.values(responses).filter(r => !r.synced).length
            + state.achados.filter(a => !a.synced).length
            + state.evidences.filter(e => !e.synced).length;
          return { responses, pendingSyncCount };
        }),

      addAchado: (achado) =>
        set((state) => {
          const newAchado: OfflineAchado = { ...achado, id: generateId(), timestamp: Date.now(), synced: false };
          const achados = [...state.achados, newAchado];
          return { achados, pendingSyncCount: state.pendingSyncCount + 1 };
        }),

      addEvidence: (evidence) =>
        set((state) => {
          const newEvidence: OfflineEvidence = { ...evidence, id: generateId(), timestamp: Date.now(), synced: false };
          const evidences = [...state.evidences, newEvidence];
          return { evidences, pendingSyncCount: state.pendingSyncCount + 1 };
        }),

      markResponseSynced: (itemId) =>
        set((state) => {
          const responses = { ...state.responses };
          if (responses[itemId]) responses[itemId] = { ...responses[itemId], synced: true };
          const pendingSyncCount = Object.values(responses).filter(r => !r.synced).length
            + state.achados.filter(a => !a.synced).length
            + state.evidences.filter(e => !e.synced).length;
          return { responses, pendingSyncCount };
        }),

      markAchadoSynced: (achadoId) =>
        set((state) => {
          const achados = state.achados.map(a => a.id === achadoId ? { ...a, synced: true } : a);
          const pendingSyncCount = Object.values(state.responses).filter(r => !r.synced).length
            + achados.filter(a => !a.synced).length
            + state.evidences.filter(e => !e.synced).length;
          return { achados, pendingSyncCount };
        }),

      markEvidenceSynced: (evidenceId) =>
        set((state) => {
          const evidences = state.evidences.map(e => e.id === evidenceId ? { ...e, synced: true } : e);
          const pendingSyncCount = Object.values(state.responses).filter(r => !r.synced).length
            + state.achados.filter(a => !a.synced).length
            + evidences.filter(e => !e.synced).length;
          return { evidences, pendingSyncCount };
        }),

      setSyncInProgress: (value) => set({ syncInProgress: value }),
      addSyncError: (error) => set((state) => ({ syncErrors: [...state.syncErrors, error] })),
      clearSyncErrors: () => set({ syncErrors: [] }),
      setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

      clearSession: () =>
        set({
          currentSessionId: null,
          currentAuditoriaId: null,
          labId: null,
          responses: {},
          achados: [],
          evidences: [],
          pendingSyncCount: 0,
          syncErrors: [],
        }),

      getPendingItems: () => {
        const state = get();
        return {
          responses: Object.values(state.responses).filter(r => !r.synced),
          achados: state.achados.filter(a => !a.synced),
          evidences: state.evidences.filter(e => !e.synced),
        };
      },
    }),
    {
      name: 'audit-offline-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
