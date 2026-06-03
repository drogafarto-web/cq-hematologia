import { useEffect, useState } from 'react';
import { LaudoVersion } from '../types/laudoVersion';
import { subscribeVersions } from '../services/laudoVersionService';
import { useActiveLabId } from '../../../store/useAuthStore';

/**
 * Hook para gerenciar versões de um laudo em tempo real
 */
export function useLaudoVersions(laudoId: string) {
  const [versions, setVersions] = useState<LaudoVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const currentLabId = useActiveLabId();

  useEffect(() => {
    if (!currentLabId || !laudoId) {
      setVersions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeVersions(
      currentLabId,
      laudoId,
      (data) => {
        setVersions(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [currentLabId, laudoId]);

  return { versions, loading, error };
}
