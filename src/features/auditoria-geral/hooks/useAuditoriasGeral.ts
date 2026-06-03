import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeAuditorias } from '../services/auditoriaGeralService';
import type { AuditoriaGeral } from '../types';

export function useAuditoriasGeral() {
  const labId = useActiveLabId();
  const [auditorias, setAuditorias] = useState<AuditoriaGeral[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(labId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setAuditorias([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeAuditorias(
      labId,
      (list) => {
        setAuditorias(list);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    return unsub;
  }, [labId]);

  return { auditorias, isLoading, error };
}
