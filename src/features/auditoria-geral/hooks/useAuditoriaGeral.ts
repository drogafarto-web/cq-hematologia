import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeAuditoria, subscribeRespostas } from '../services/auditoriaGeralService';
import type { AuditoriaGeral, RespostaIndicador } from '../types';

export function useAuditoriaGeral(auditoriaId: string | null) {
  const labId = useActiveLabId();
  const [auditoria, setAuditoria] = useState<AuditoriaGeral | null>(null);
  const [respostas, setRespostas] = useState<RespostaIndicador[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(labId && auditoriaId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !auditoriaId) {
      setAuditoria(null);
      setRespostas([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubDoc = subscribeAuditoria(
      labId,
      auditoriaId,
      (a) => {
        setAuditoria(a);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      },
    );
    const unsubRespostas = subscribeRespostas(
      labId,
      auditoriaId,
      (list) => {
        setRespostas(list);
      },
      (err) => {
        setError(err);
      },
    );
    return () => {
      unsubDoc();
      unsubRespostas();
    };
  }, [labId, auditoriaId]);

  return { auditoria, respostas, isLoading, error };
}
