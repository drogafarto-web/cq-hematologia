import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../core/firebase';
import {
  useAuditOfflineStore,
  ChecklistResponse,
  OfflineAchado,
  OfflineEvidence,
} from '../store/useAuditOfflineStore';

export interface SyncResult {
  success: boolean;
  responsesSynced: number;
  achadosSynced: number;
  evidencesSynced: number;
  errors: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  inProgress: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 9000];

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }
  throw new Error('Max retries exceeded');
}

export class SyncService {
  private isOnline: boolean = true;
  private unsubscribeNetInfo: (() => void) | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private onStatusChange?: (status: SyncStatus) => void;

  constructor(onStatusChange?: (status: SyncStatus) => void) {
    this.onStatusChange = onStatusChange;
  }

  startMonitoring(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = !!state.isConnected;

      if (wasOffline && this.isOnline) {
        this.syncNow();
      }

      this.emitStatus();
    });

    this.syncInterval = setInterval(() => {
      if (this.isOnline) this.syncNow();
    }, 60000);
  }

  stopMonitoring(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncNow(): Promise<SyncResult> {
    const store = useAuditOfflineStore.getState();
    if (store.syncInProgress || !this.isOnline) {
      return {
        success: false,
        responsesSynced: 0,
        achadosSynced: 0,
        evidencesSynced: 0,
        errors: ['Sync already in progress or offline'],
      };
    }

    store.setSyncInProgress(true);
    store.clearSyncErrors();
    const errors: string[] = [];
    let responsesSynced = 0;
    let achadosSynced = 0;
    let evidencesSynced = 0;

    try {
      const { responses, achados, evidences } = store.getPendingItems();
      const { labId, currentAuditoriaId, currentSessionId } = store;

      if (!labId || !currentAuditoriaId || !currentSessionId) {
        return {
          success: true,
          responsesSynced: 0,
          achadosSynced: 0,
          evidencesSynced: 0,
          errors: [],
        };
      }

      // Sync responses in batch
      if (responses.length > 0) {
        try {
          const batchSave = httpsCallable(functions, 'batchSaveResponses');
          await withRetry(() =>
            batchSave({
              labId,
              auditoriaId: currentAuditoriaId,
              sessaoId: currentSessionId,
              responses: responses.map((r) => ({
                itemId: r.itemId,
                resposta: r.resposta,
                severidade: r.severidade,
                observacao: r.observacao,
              })),
            }),
          );
          responses.forEach((r) => store.markResponseSynced(r.itemId));
          responsesSynced = responses.length;
        } catch (err: any) {
          errors.push(`Responses: ${err.message}`);
          store.addSyncError(`Falha ao sincronizar respostas: ${err.message}`);
        }
      }

      // Sync evidences (upload files)
      for (const evidence of evidences) {
        try {
          const filePath = `labs/${labId}/audit-evidence/${currentAuditoriaId}/${currentSessionId}/${evidence.id}`;
          const storageRef = ref(storage, filePath);
          const response = await fetch(evidence.localUri);
          const blob = await response.blob();
          await withRetry(() => uploadBytes(storageRef, blob));
          const url = await getDownloadURL(storageRef);
          store.markEvidenceSynced(evidence.id);
          evidencesSynced++;
        } catch (err: any) {
          errors.push(`Evidence ${evidence.id}: ${err.message}`);
          store.addSyncError(`Falha ao enviar evidência: ${err.message}`);
        }
      }

      // Sync achados
      for (const achado of achados) {
        try {
          const createAchado = httpsCallable(functions, 'registerAchado');
          await withRetry(() =>
            createAchado({
              labId,
              auditoriaId: currentAuditoriaId,
              sessaoId: currentSessionId,
              itemId: achado.itemId,
              descricao: achado.descricao,
              severidade: achado.severidade,
            }),
          );
          store.markAchadoSynced(achado.id);
          achadosSynced++;
        } catch (err: any) {
          errors.push(`Achado ${achado.id}: ${err.message}`);
          store.addSyncError(`Falha ao sincronizar achado: ${err.message}`);
        }
      }

      store.setLastSyncAt(Date.now());
    } finally {
      store.setSyncInProgress(false);
      this.emitStatus();
    }

    return {
      success: errors.length === 0,
      responsesSynced,
      achadosSynced,
      evidencesSynced,
      errors,
    };
  }

  getSyncStatus(): SyncStatus {
    const store = useAuditOfflineStore.getState();
    return {
      isOnline: this.isOnline,
      pendingCount: store.pendingSyncCount,
      lastSyncAt: store.lastSyncAt ? new Date(store.lastSyncAt) : null,
      inProgress: store.syncInProgress,
    };
  }

  private emitStatus(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.getSyncStatus());
    }
  }
}
