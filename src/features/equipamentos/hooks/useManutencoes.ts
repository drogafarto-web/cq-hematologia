/**
 * useManutencoes — assinatura em tempo real das manutenções do equipamento.
 *
 * Firestore: `/labs/{labId}/equipamentos/{equipamentoId}/manutencoes`
 */

import { useEffect, useState } from 'react';
import { collection, getFirestore, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import type { ManutencaoPreventiva } from '../types/ManutencaoPreventiva';

export interface UseManutencoesParams {
  labId: string | null;
  equipamentoId: string | null;
}

export interface UseManutencoesResult {
  manutencoes: ManutencaoPreventiva[];
  loading: boolean;
  error: string | null;
}

export function useManutencoes({
  labId,
  equipamentoId,
}: UseManutencoesParams): UseManutencoesResult {
  const [manutencoes, setManutencoes] = useState<ManutencaoPreventiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!labId || !equipamentoId) {
      setManutencoes([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db = getFirestore();
    const q = query(
      collection(db, 'labs', labId, 'equipamentos', equipamentoId, 'manutencoes'),
      orderBy('dataPrevista', 'desc'),
      limit(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
          } as ManutencaoPreventiva;
        });
        setManutencoes(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, equipamentoId]);

  return { manutencoes, loading, error };
}
