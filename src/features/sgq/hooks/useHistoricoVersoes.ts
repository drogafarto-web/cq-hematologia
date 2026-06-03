import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { VersaoHistorico } from '../types/Documento';
import { useActiveLabId } from '../../../store/useAuthStore';

export interface UseHistoricoVersoesResult {
  versoes: VersaoHistorico[];
  isLoading: boolean;
}

export function useHistoricoVersoes(documentoId: string | null): UseHistoricoVersoesResult {
  const labId = useActiveLabId();
  const [versoes, setVersoes] = useState<VersaoHistorico[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!labId || !documentoId) {
      setVersoes([]);
      setIsLoading(false);
      return;
    }

    const colRef = collection(db, `labs/${labId}/sgq-documentos/${documentoId}/historico-versoes`);
    const q = query(colRef, orderBy('data', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: VersaoHistorico[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as VersaoHistorico[];
        setVersoes(items);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, documentoId]);

  return { versoes, isLoading };
}
