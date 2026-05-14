import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribePlanosAcao } from '../services/auditoriaGeralService';
import type { PlanoAcao } from '../types';

export function usePlanosAcao(auditoriaId: string | null) {
  const labId = useActiveLabId();
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(labId && auditoriaId));

  useEffect(() => {
    if (!labId || !auditoriaId) {
      setPlanos([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribePlanosAcao(
      labId,
      auditoriaId,
      (list) => { setPlanos(list); setIsLoading(false); },
      () => { setIsLoading(false); },
    );
    return unsub;
  }, [labId, auditoriaId]);

  return { planos, isLoading };
}
