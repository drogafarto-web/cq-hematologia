import { useEffect, useState } from 'react';
import { listEquipamentosByModule } from '../../equipamentos/services/equipamentoService';
import type { Equipamento } from '../../equipamentos/types/Equipamento';

interface UseEquipamentosListResult {
  equipamentos: Equipamento[];
  loading: boolean;
  error: string | null;
}

export function useEquipamentosList(labId: string): UseEquipamentosListResult {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listEquipamentosByModule(labId, 'coagulacao')
      .then((data) => {
        if (!cancelled) {
          setEquipamentos(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [labId]);

  return { equipamentos, loading, error };
}
