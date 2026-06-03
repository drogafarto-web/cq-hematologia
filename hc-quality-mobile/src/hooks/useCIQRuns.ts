import { useEffect, useState } from 'react';
// @ts-ignore - firebase/firestore types
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../core/firebase';
import { useAuthStore } from '../store/useAuthStore';

export interface CIQRun {
  id: string;
  labId: string;
  equipmentId: string;
  runType: 'CIQ' | 'VALIDATION';
  startedAt: number; // timestamp ms
  status: 'valid' | 'invalid' | 'pending';
  comments: string;
  operatorId: string;
  createdAt: number;
  deletadoEm?: number | null;
}

export function useCIQRuns() {
  const labId = useAuthStore((s) => s.activeLabId);
  const [runs, setRuns] = useState<CIQRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    let q;
    try {
      q = query(
        collection(db, `labs/${labId}/runs`),
        where('deletadoEm', '==', null), // RN-06: soft delete check
        orderBy('startedAt', 'desc'),
      );
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const data: CIQRun[] = snapshot.docs.map((doc: any) => ({
          ...(doc.data() as Omit<CIQRun, 'id'>),
          id: doc.id,
        }));
        setRuns(data);
        setLoading(false);
        setError(null);
      },
      (err: any) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId]);

  return { runs, loading, error };
}
