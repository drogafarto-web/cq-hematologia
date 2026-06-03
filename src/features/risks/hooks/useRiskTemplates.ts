/**
 * useRiskTemplates — onSnapshot em templates ativos do lab.
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import type { RiskTemplate } from '../types/RiskTemplate';

export interface UseRiskTemplatesResult {
  readonly templates: RiskTemplate[];
  readonly loading: boolean;
  readonly error: Error | null;
}

export function useRiskTemplates(labId: string | null | undefined): UseRiskTemplatesResult {
  const [templates, setTemplates] = useState<RiskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setTemplates([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, `labs/${labId}/risk-templates`), where('ativo', '==', true));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = d.data();
          return { id: d.id, ...raw } as RiskTemplate;
        });
        list.sort((a, b) => {
          const byCat = a.categoria.localeCompare(b.categoria, 'pt-BR');
          if (byCat !== 0) return byCat;
          return a.titulo.localeCompare(b.titulo, 'pt-BR');
        });
        setTemplates(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsub();
    };
  }, [labId]);

  return { templates, loading, error };
}
