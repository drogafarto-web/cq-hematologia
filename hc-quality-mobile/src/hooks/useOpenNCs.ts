import { useEffect, useState } from 'react';
// @ts-ignore - firebase/firestore types
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../core/firebase';
import { useAuthStore } from '../store/useAuthStore';

export interface NC {
  id: string;
  labId: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  description: string;
  detectadoEm: number; // timestamp ms
  equipmentId: string;
  moduleId: string;
  createdAt: number;
  updatedAt: number;
  deletadoEm?: number | null;
}

/**
 * useOpenNCs — subscribes to open + investigating non-conformities
 * for the authenticated lab via Firestore onSnapshot.
 *
 * Firestore path: /labs/{labId}/naoConformidades
 * Filters:
 *   - status in ['open', 'investigating'] (active NCs only)
 *   - deletadoEm == null (RN-06 soft delete)
 * Order: detectadoEm asc (oldest first — highest priority at top)
 */
export function useOpenNCs() {
  const labId = useAuthStore((s) => s.activeLabId);
  const [ncs, setNCs] = useState<NC[]>([]);
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
        collection(db, `labs/${labId}/naoConformidades`),
        where('status', 'in', ['open', 'investigating']),
        where('deletadoEm', '==', null), // RN-06: soft delete filter
        orderBy('detectadoEm', 'asc'),
      );
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const data: NC[] = snapshot.docs.map((doc: any) => ({
          ...(doc.data() as Omit<NC, 'id'>),
          id: doc.id,
        }));
        setNCs(data);
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

  return { ncs, loading, error };
}
