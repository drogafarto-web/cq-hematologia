/**
 * useKpiMetas — onSnapshot em metas ativas (`/labs/{labId}/kpi-metas`, `ativo === true`).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { KPIMeta, KPIMetaUnidade } from '../types/KPIMeta';

const UNIDADES: ReadonlySet<KPIMetaUnidade> = new Set(['percent', 'hours', 'count']);

function mapMetaDoc(labId: string, doc: QueryDocumentSnapshot): KPIMeta | null {
  const raw = doc.data();
  const tipoKPI = typeof raw.tipoKPI === 'string' ? raw.tipoKPI : '';
  const valor = typeof raw.valor === 'number' && Number.isFinite(raw.valor) ? raw.valor : NaN;
  const unidade = raw.unidade as string | undefined;
  const vigenciaInicio = raw.vigenciaInicio;
  const definidoPor = typeof raw.definidoPor === 'string' ? raw.definidoPor : '';
  const definidoPorNome = typeof raw.definidoPorNome === 'string' ? raw.definidoPorNome : '';
  const criadoEm = raw.criadoEm;

  if (
    !tipoKPI ||
    !Number.isFinite(valor) ||
    !unidade ||
    !UNIDADES.has(unidade as KPIMetaUnidade) ||
    !(vigenciaInicio instanceof Timestamp) ||
    !definidoPor ||
    !(criadoEm instanceof Timestamp)
  ) {
    return null;
  }

  const vigenciaFim = raw.vigenciaFim;
  const vigenciaFimNorm = vigenciaFim instanceof Timestamp ? vigenciaFim : undefined;

  const docLabId = typeof raw.labId === 'string' && raw.labId.length > 0 ? raw.labId : labId;

  const meta: KPIMeta = {
    id: doc.id,
    labId: docLabId,
    tipoKPI,
    valor,
    unidade: unidade as KPIMetaUnidade,
    vigenciaInicio,
    vigenciaFim: vigenciaFimNorm,
    definidoPor,
    definidoPorNome,
    criadoEm,
    ativo: true,
  };

  return meta;
}

export interface UseKpiMetasResult {
  readonly metas: KPIMeta[];
  readonly getMetaByTipo: (tipo: string) => KPIMeta | undefined;
  readonly loading: boolean;
  readonly error: Error | null;
}

/**
 * @param labIdOverride — quando definido (string não vazia), inscreve em `kpi-metas` desse lab em vez do laboratório ativo da sessão (ex.: `KPIDashboard` com `labId` explícito).
 */
export function useKpiMetas(labIdOverride?: string | null): UseKpiMetasResult {
  const activeLabId = useActiveLabId();
  const labId = labIdOverride && labIdOverride.length > 0 ? labIdOverride : activeLabId;
  const [metas, setMetas] = useState<KPIMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId) {
      setMetas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(collection(db, `labs/${labId}/kpi-metas`), where('ativo', '==', true));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: KPIMeta[] = [];
        for (const d of snap.docs) {
          const m = mapMetaDoc(labId, d);
          if (m) list.push(m);
        }
        list.sort((a, b) => a.tipoKPI.localeCompare(b.tipoKPI, 'pt-BR'));
        setMetas(list);
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

  const getMetaByTipo = useCallback(
    (tipo: string) => metas.find((m) => m.tipoKPI === tipo),
    [metas],
  );

  return { metas, getMetaByTipo, loading, error };
}
