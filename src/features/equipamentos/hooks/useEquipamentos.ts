/**
 * useEquipamentos — assinatura em tempo real dos equipamentos do lab.
 *
 * Default: mostra apenas 'ativo' + 'manutencao' (oculta aposentados). Passar
 * `{ status: 'aposentado' }` em relatórios históricos.
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToEquipamentos } from '../services/equipamentoService';
import type { Equipamento, EquipamentoFilters } from '../types/Equipamento';

interface UseEquipamentosResult {
  equipamentos: Equipamento[];
  isLoading: boolean;
  error: string | null;
}

export function useEquipamentos(
  filters: EquipamentoFilters = {},
): UseEquipamentosResult {
  const labId = useActiveLabId();
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stringify filtros para estabilizar dependency do useEffect (arrays em
  // status seriam referência nova a cada render sem isso).
  const depKey = JSON.stringify(filters);

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!labId) {
      setEquipamentos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const unsub = subscribeToEquipamentos(
      labId,
      (list) => {
        setEquipamentos(list);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
      filters,
    );

    return unsub;
  }, [labId, depKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return { equipamentos, isLoading, error };
}
