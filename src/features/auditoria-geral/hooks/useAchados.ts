import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeAchados } from '../services/achadosService';
import type { Achado } from '../types';

export function useAchados(auditoriaId: string) {
  const labId = useActiveLabId();
  const [achados, setAchados] = useState<Achado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!labId || !auditoriaId) return;

    setIsLoading(true);
    const unsub = subscribeAchados(
      labId,
      auditoriaId,
      (data) => {
        setAchados(data);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [labId, auditoriaId]);

  return { achados, isLoading };
}
