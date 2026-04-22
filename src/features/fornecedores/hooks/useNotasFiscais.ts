/**
 * useNotasFiscais — subscription tempo real às notas fiscais do lab ativo.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToNotasFiscais,
  type NotaFiscalFilters,
} from '../services/notaFiscalService';
import type { NotaFiscal } from '../types/NotaFiscal';

interface UseNotasFiscaisResult {
  notas: NotaFiscal[];
  isLoading: boolean;
  error: string | null;
}

export function useNotasFiscais(filters: NotaFiscalFilters = {}): UseNotasFiscaisResult {
  const labId = useActiveLabId();
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setNotas([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const parsed = JSON.parse(filterKey) as NotaFiscalFilters;

    const unsub = subscribeToNotasFiscais(
      labId,
      (incoming) => {
        setNotas(incoming);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      parsed,
    );
    return unsub;
  }, [labId, filterKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { notas, isLoading, error };
}
