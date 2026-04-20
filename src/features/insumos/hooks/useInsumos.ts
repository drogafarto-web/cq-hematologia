/**
 * useInsumos — assinatura em tempo real do catálogo de insumos do lab ativo.
 *
 * Aceita filtros opcionais (tipo, modulo, status, query textual). Mudanças nos
 * filtros reassinam no servidor quando os campos indexados mudam; `query`
 * textual filtra no cliente para evitar complexidade de índice composto.
 *
 * @example
 *   const { insumos, isLoading, error } = useInsumos({ tipo: 'controle', status: 'ativo' });
 */

import { useEffect, useState, useMemo } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToInsumos } from '../services/insumosFirebaseService';
import type { Insumo, InsumoFilters } from '../types/Insumo';

interface UseInsumosResult {
  insumos: Insumo[];
  isLoading: boolean;
  error: string | null;
}

export function useInsumos(filters: InsumoFilters = {}): UseInsumosResult {
  const labId = useActiveLabId();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serializa filtros para usar como dep de useEffect — evita re-subscribe
  // sempre que o caller constrói um novo literal de objeto por render.
  const filterKey = useMemo(
    () => JSON.stringify(filters),
    [filters],
  );

  // Guard + subscription pattern — ver useCIQLots para justificativa.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId) {
      setInsumos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const parsed = JSON.parse(filterKey) as InsumoFilters;

    const unsub = subscribeToInsumos(
      labId,
      (incoming) => {
        setInsumos(incoming);
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

  return { insumos, isLoading, error };
}
