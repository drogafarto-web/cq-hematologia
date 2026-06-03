/**
 * useEquipamentoUso — assinatura em tempo real dos registros de uso do equipamento.
 *
 * Firestore: `/labs/{labId}/equipamentos/{equipamentoId}/usos`
 */

import { useEffect, useState } from 'react';
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import type { EquipamentoUso } from '../types/EquipamentoUso';

export interface UseEquipamentoUsoParams {
  labId: string | null;
  equipamentoId: string | null;
}

export interface UseEquipamentoUsoResult {
  usos: EquipamentoUso[];
  loading: boolean;
  error: string | null;
}

export function useEquipamentoUso({
  labId,
  equipamentoId,
}: UseEquipamentoUsoParams): UseEquipamentoUsoResult {
  const [usos, setUsos] = useState<EquipamentoUso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !equipamentoId) {
      setUsos([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirestore();
    const q = query(
      collection(db, 'labs', labId, 'equipamentos', equipamentoId, 'usos'),
      orderBy('inicio', 'desc'),
      limit(30),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
          } as EquipamentoUso;
        });
        setUsos(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, equipamentoId]);

  return { usos, loading, error };
}
