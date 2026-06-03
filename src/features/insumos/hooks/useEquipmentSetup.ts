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

/**
 * @param setupDocId - Primary doc ID (equipamentoId in Fase D, or module in legacy).
 * @param fallbackDocId - Optional fallback doc ID to try when primary doc doesn't exist.
 *   Used during Fase A→D migration: equipment ID doc may not exist yet if insumos
 *   were configured under the legacy module-level doc.
 */
export function useEquipmentSetup(
  setupDocId: string | null,
  fallbackDocId?: string | null,
): UseEquipmentSetupResult {
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
    let unsubFallback: (() => void) | null = null;

    const unsub = subscribeToSetupById(
      labId,
      setupDocId,
      (incoming) => {
        if (incoming) {
          if (unsubFallback) {
            unsubFallback();
            unsubFallback = null;
          }
          setSetup(incoming);
          if (firstSnapshot) {
            setIsLoading(false);
            firstSnapshot = false;
          }
        } else if (fallbackDocId && fallbackDocId !== setupDocId) {
          unsubFallback = subscribeToSetupById(
            labId,
            fallbackDocId,
            (fallbackSetup) => {
              setSetup(fallbackSetup);
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
        } else {
          setSetup(null);
          if (firstSnapshot) {
            setIsLoading(false);
            firstSnapshot = false;
          }
        }
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );

    return () => {
      unsub();
      if (unsubFallback) unsubFallback();
    };
  }, [labId, setupDocId, fallbackDocId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { setup, isLoading, error };
}
