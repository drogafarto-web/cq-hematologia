/**
 * useDocumentos — hook de documentos vinculados a um equipamento.
 * Realtime subscription via Firestore onSnapshot.
 */

import { useEffect, useState } from 'react';
import type { EquipamentoDocumento } from '../types/EquipamentoDocumento';
import { subscribeDocumentos } from '../services/documentoService';

interface UseDocumentosResult {
  documentos: EquipamentoDocumento[];
  isLoading: boolean;
  error: string | null;
}

export function useDocumentos(
  labId: string | null,
  equipamentoId: string | null,
): UseDocumentosResult {
  const [documentos, setDocumentos] = useState<EquipamentoDocumento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !equipamentoId) {
      setDocumentos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsub = subscribeDocumentos(
      labId,
      equipamentoId,
      (docs) => {
        setDocumentos(docs);
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, equipamentoId]);

  return { documentos, isLoading, error };
}
