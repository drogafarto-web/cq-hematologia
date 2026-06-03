import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { useActiveLab } from '../../../store/useAuthStore';
import { VHS_LIST_LIMIT } from '../constants/vhsConstants';
import type { VHSExam, VHSStatus } from '../types/VHSExam';

export interface UseVHSExamsOptions {
  status?: VHSStatus;
  limitN?: number;
}

export interface UseVHSExamsResult {
  exams: VHSExam[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook de subscription em tempo real dos exames VHS do laboratório ativo.
 *
 * Mantém uma conexão `onSnapshot` com a coleção `/labs/{labId}/vhs-exams`,
 * aplicando filtros opcionais por status e limite de resultados.
 *
 * O padrão de subscription em tempo real garante auditabilidade contínua
 * conforme RDC 978 Art. 128 — o operador visualiza imediatamente qualquer
 * alteração de estado (liberação, divergência, cancelamento) sem recarregar
 * a página, eliminando janelas de inconsistência que comprometem a
 * rastreabilidade.
 */
export function useVHSExams(options: UseVHSExamsOptions = {}): UseVHSExamsResult {
  const activeLab = useActiveLab();
  const [exams, setExams] = useState<VHSExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!activeLab?.id) {
      setExams([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const constraints: any[] = [];
    if (options.status) constraints.push(where('status', '==', options.status));
    constraints.push(orderBy('criadoEm', 'desc'));
    constraints.push(limit(options.limitN ?? VHS_LIST_LIMIT));
    const q = query(collection(db, 'labs', activeLab.id, 'vhs-exams'), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExams(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VHSExam));
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [activeLab?.id, options.status, options.limitN]);

  return { exams, isLoading, error };
}
