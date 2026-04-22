/**
 * useProdutos — assinatura em tempo real ao catálogo de produtos do lab ativo.
 *
 * Espelha `useInsumos` mas pro catálogo (Fase C). Filtros opcionais por tipo,
 * módulo e busca textual.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import {
  subscribeToProdutos,
  type ProdutoFilters,
} from '../services/produtoInsumoService';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';

interface UseProdutosResult {
  produtos: ProdutoInsumo[];
  isLoading: boolean;
  error: string | null;
}

export function useProdutos(filters: ProdutoFilters = {}): UseProdutosResult {
  const labId = useActiveLabId();
  const [produtos, setProdutos] = useState<ProdutoInsumo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setProdutos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const parsed = JSON.parse(filterKey) as ProdutoFilters;

    const unsub = subscribeToProdutos(
      labId,
      (incoming) => {
        setProdutos(incoming);
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

  return { produtos, isLoading, error };
}
