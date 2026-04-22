/**
 * useFornecedores — subscription tempo real ao cadastro de fornecedores
 * do lab ativo.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToFornecedores,
  type FornecedorFilters,
} from '../services/fornecedorService';
import type { Fornecedor } from '../types/Fornecedor';

interface UseFornecedoresResult {
  fornecedores: Fornecedor[];
  isLoading: boolean;
  error: string | null;
}

export function useFornecedores(filters: FornecedorFilters = {}): UseFornecedoresResult {
  const labId = useActiveLabId();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setFornecedores([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const parsed = JSON.parse(filterKey) as FornecedorFilters;

    const unsub = subscribeToFornecedores(
      labId,
      (incoming) => {
        setFornecedores(incoming);
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

  return { fornecedores, isLoading, error };
}
