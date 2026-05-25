import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { RTAction } from '../types/RTAction';

interface UseRTActionsByTargetResult {
  actions: RTAction[];
  isLoading: boolean;
  error: string | null;
}

export function useRTActionsByTarget(
  labId: string,
  targetRef: { type: 'ControlOperacional' | 'Attempt'; id: string },
): UseRTActionsByTargetResult {
  const [actions, setActions] = useState<RTAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !targetRef.id) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'labs', labId, 'rt-actions'),
      where('targetRef.type', '==', targetRef.type),
      where('targetRef.id', '==', targetRef.id),
      orderBy('criadoEm', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setActions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RTAction)));
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [labId, targetRef.type, targetRef.id]);

  return { actions, isLoading, error };
}
