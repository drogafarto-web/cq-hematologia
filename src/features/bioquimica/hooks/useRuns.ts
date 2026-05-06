import { useEffect, useState } from 'react';
import { query, collection, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Run } from '../types';

interface UseRunsFilter {
  equipmentId?: string;
  statusFilter?: 'Aprovada' | 'Rejeitada' | 'all';
  days?: number; // Default: 30 days
}

export interface UseRunsResult {
  runs: Run[];
  loading: boolean;
  error: Error | null;
}

export function useRuns(labId: string, filters?: UseRunsFilter): UseRunsResult {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const days = filters?.days ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  useEffect(() => {
    const constraints = [
      where('labId', '==', labId),
      where('criadoEm', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('criadoEm', 'desc'),
    ];

    if (filters?.equipmentId) {
      constraints.push(where('equipmentId', '==', filters.equipmentId));
    }

    const q = query(collection(db, `labs/${labId}/bioquimica/runs`), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as Run));

        // Filter by status if specified
        if (filters?.statusFilter && filters.statusFilter !== 'all') {
          const filtered = data.filter((r) => r.status === filters.statusFilter);
          setRuns(filtered);
        } else {
          setRuns(data);
        }

        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [labId, filters?.equipmentId, filters?.statusFilter, days]);

  return { runs, loading, error };
}
