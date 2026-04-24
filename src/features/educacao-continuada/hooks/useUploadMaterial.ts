import { useCallback, useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  deleteMaterialFromStorage,
  uploadMaterialToStorage,
  type UploadMaterialResult,
} from '../services/ecFirebaseService';

export type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; pct: number; filename: string }
  | { kind: 'done'; result: UploadMaterialResult }
  | { kind: 'error'; message: string };

export interface UseUploadMaterialResult {
  status: UploadStatus;
  /** Faz upload e retorna `{downloadUrl, storagePath, tamanhoBytes}`. Lança em erro. */
  upload: (templateId: string, file: File) => Promise<UploadMaterialResult>;
  /** Remove arquivo do Storage pelo path salvo no material. Idempotente. */
  remove: (storagePath: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook de upload/delete de materiais didáticos no Firebase Storage (Fase 6).
 * Encapsula tracking de progress. Erros comuns (arquivo grande, permissão)
 * voltam como `status.kind === 'error'` com `message` amigável.
 */
export function useUploadMaterial(): UseUploadMaterialResult {
  const labId = useActiveLabId();
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });

  const upload = useCallback(
    async (templateId: string, file: File): Promise<UploadMaterialResult> => {
      if (!labId) throw new Error('Sem lab ativo.');
      setStatus({ kind: 'uploading', pct: 0, filename: file.name });
      try {
        const result = await uploadMaterialToStorage(labId, templateId, file, (pct) => {
          setStatus({ kind: 'uploading', pct, filename: file.name });
        });
        setStatus({ kind: 'done', result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao enviar arquivo.';
        setStatus({ kind: 'error', message });
        throw err;
      }
    },
    [labId],
  );

  const remove = useCallback(async (storagePath: string): Promise<void> => {
    return deleteMaterialFromStorage(storagePath);
  }, []);

  const reset = useCallback(() => setStatus({ kind: 'idle' }), []);

  return { status, upload, remove, reset };
}
