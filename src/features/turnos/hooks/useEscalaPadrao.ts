import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { EscalaPadrao } from '../types/Escala';
import type { LabId } from '../types/shared_refs';

interface UseEscalaPadraoResult {
  padrao: EscalaPadrao | null;
  loading: boolean;
  error: Error | null;
}

export function useEscalaPadrao(): UseEscalaPadraoResult {
  const labId = useActiveLabId() as LabId | null;
  const [padrao, setPadrao] = useState<EscalaPadrao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setPadrao(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, 'labs', labId, 'turnos-config', 'escala-padrao');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setPadrao({
            labId: d.labId as string,
            diasAtivos: (d.diasAtivos ?? []) as number[],
            turnos: (d.turnos ?? []) as EscalaPadrao['turnos'],
            updatedAt: d.updatedAt,
            updatedBy: d.updatedBy as string,
          });
        } else {
          setPadrao(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId]);

  return { padrao, loading, error };
}
