import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../../../types';
import SatisfacaoService, { type NPSResposta } from '../services/satisfacaoService';

interface NPSScore {
  nps: number;
  total: number;
  promotores: number;
  neutros: number;
  detratores: number;
  isLoading: boolean;
  error: Error | null;
}

export function useNPSScore(
  labId: LabId,
  filters?: { origem?: 'pos-reclamacao' | 'trimestral' }
): NPSScore {
  const [respostas, setRespostas] = useState<NPSResposta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const constraints = [
      where('labId', '==', labId),
      orderBy('respondidoEm', 'desc'),
    ];

    if (filters?.origem) {
      constraints.push(where('origem', '==', filters.origem));
    }

    const q = query(collection(db, `labs/${labId}/satisfacao-respostas`), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as NPSResposta));

        setRespostas(data);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, filters?.origem]);

  const nps = SatisfacaoService.calculateNPS(respostas);
  const breakdown = SatisfacaoService.getCategoryBreakdown(respostas);

  return {
    nps,
    total: respostas.length,
    promotores: breakdown.promotores,
    neutros: breakdown.neutros,
    detratores: breakdown.detratores,
    isLoading,
    error,
  };
}
