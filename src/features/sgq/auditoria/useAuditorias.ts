import { useEffect, useState, useCallback } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { Auditoria, AuditoriaFilters } from '../types/Auditoria';
import { subscribeAuditorias, updateAuditoriaStatus, softDeleteAuditoria } from './auditoriaService';

export function useAuditorias(filters: AuditoriaFilters = {}) {
  const labId = useActiveLabId();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeAuditorias(
      labId,
      filters,
      (data) => {
        setAuditorias(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [labId, JSON.stringify(filters)]);

  const updateStatus = useCallback(
    async (auditoriaId: string, novoStatus: Auditoria['status']) => {
      if (!labId) throw new Error('Lab não selecionado');
      return updateAuditoriaStatus(labId, auditoriaId, novoStatus);
    },
    [labId],
  );

  const deletar = useCallback(
    async (auditoriaId: string) => {
      if (!labId) throw new Error('Lab não selecionado');
      return softDeleteAuditoria(labId, auditoriaId);
    },
    [labId],
  );

  return { auditorias, loading, error, updateStatus, deletar };
}
