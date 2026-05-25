import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { ControlOperacional } from '../types/ControlOperacional';

interface UseControlOperacionalResult {
  controls: ControlOperacional[];
  isLoading: boolean;
  error: string | null;
}

export function useControlOperacional(labId: string): UseControlOperacionalResult {
  const [controls, setControls] = useState<ControlOperacional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'labs', labId, 'control-operacional'),
      where('status', 'in', ['ativo', 'pausado']),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setControls(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ControlOperacional)));
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [labId]);

  return { controls, isLoading, error };
}
