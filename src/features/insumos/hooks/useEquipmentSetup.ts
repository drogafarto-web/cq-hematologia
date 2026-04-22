/**
 * useEquipmentSetup — assinatura em tempo real do Setup atual do equipamento.
 *
 * Fase A: docId = module. Fase D: docId = equipamentoId. Os dois convivem
 * durante a migração — caller passa o que já tem.
 *
 * @example
 *   // Legado
 *   const { setup } = useEquipmentSetup('hematologia');
 *   // Fase D
 *   const { setup } = useEquipmentSetup(equipamento.id);
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { subscribeToSetupById } from '../services/equipmentSetupService';
import type { EquipmentSetup } from '../types/EquipmentSetup';

interface UseEquipmentSetupResult {
  setup: EquipmentSetup | null;
  isLoading: boolean;
  error: string | null;
}

export function useEquipmentSetup(setupDocId: string | null): UseEquipmentSetupResult {
  const labId = useActiveLabId();
  const [setup, setSetup] = useState<EquipmentSetup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!labId || !setupDocId) {
      setSetup(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let firstSnapshot = true;
    const unsub = subscribeToSetupById(
      labId,
      setupDocId,
      (incoming) => {
        setSetup(incoming);
        if (firstSnapshot) {
          setIsLoading(false);
          firstSnapshot = false;
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [labId, setupDocId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { setup, isLoading, error };
}
