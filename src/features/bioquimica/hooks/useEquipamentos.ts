/**
 * useEquipamentos — equipment list filtered for bioquímica
 *
 * Reuses hook from equipamentos module with bioquímica-specific filtering:
 * - Ativo === true
 * - analytics.bioquimica !== false
 */

import { useEffect, useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { Equipamento } from '../../equipamentos/types';

export function useEquipamentos() {
  const labId = useActiveLabId();
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!labId) {
      setEquipamentos([]);
      setLoading(false);
      return;
    }

    // Subscribe to active equipamentos for bioquímica
    const ref = collection(db, 'labs', labId, 'equipamentos');
    const q = query(
      ref,
      where('ativo', '==', true),
      where('deletadoEm', '==', null),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items: Equipamento[] = [];
      snap.forEach((doc) => {
        const equip = doc.data() as Equipamento;
        // Filter by module: include if module is bioquimica
        if (equip.module === 'bioquimica') {
          items.push(equip);
        }
      });
      setEquipamentos(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [labId]);

  return { equipamentos, loading };
}
