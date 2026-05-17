/**
 * personnel/hooks/useColaboradorTreinamentos.ts
 *
 * Cross-module read: fetches participações + execuções from educacaoContinuada
 * to build a training history for a given colaborador.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  db,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

export interface TreinamentoRealizado {
  titulo: string;
  dataRealizacao: Date | null;
  cargaHoraria: number;
  resultado: string;
  certificadoUrl?: string;
}

export interface UseColaboradorTreinamentosResult {
  treinamentos: TreinamentoRealizado[];
  horasAno: number;
  loading: boolean;
  error: Error | null;
}

interface ParticipanteDoc {
  execucaoId: string;
  colaboradorId: string;
  presente: boolean;
  deletadoEm: unknown;
}

interface ExecucaoDoc {
  id: string;
  treinamentoId: string;
  dataAplicacao?: { toDate: () => Date };
  status: string;
  deletadoEm: unknown;
}

interface TreinamentoDoc {
  id: string;
  titulo: string;
  cargaHoraria: number;
}

export function useColaboradorTreinamentos(
  colaboradorId: string | null,
): UseColaboradorTreinamentosResult {
  const labId = useActiveLabId();
  const [participacoes, setParticipacoes] = useState<ParticipanteDoc[]>([]);
  const [execucoes, setExecucoes] = useState<ExecucaoDoc[]>([]);
  const [treinamentosMap, setTreinamentosMap] = useState<Map<string, TreinamentoDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to participacoes for this colaborador
  useEffect(() => {
    if (!labId || !colaboradorId) {
      setParticipacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const col = collection(db, 'educacaoContinuada', labId, 'participantes');
    const q = query(
      col,
      where('colaboradorId', '==', colaboradorId),
      where('deletadoEm', '==', null),
    );

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          ...d.data(),
          execucaoId: d.data().execucaoId as string,
          colaboradorId: d.data().colaboradorId as string,
          presente: d.data().presente as boolean,
          deletadoEm: d.data().deletadoEm,
        })) as ParticipanteDoc[];
        setParticipacoes(items.filter((p) => p.presente));
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, colaboradorId]);

  // Fetch execucoes for the participacoes
  useEffect(() => {
    if (!labId || participacoes.length === 0) {
      setExecucoes([]);
      setLoading(false);
      return;
    }

    const execIds = [...new Set(participacoes.map((p) => p.execucaoId))];
    const col = collection(db, 'educacaoContinuada', labId, 'execucoes');

    // Firestore 'in' queries limited to 30 items per batch
    const batches: string[][] = [];
    for (let i = 0; i < execIds.length; i += 30) {
      batches.push(execIds.slice(i, i + 30));
    }

    let cancelled = false;

    Promise.all(
      batches.map((batch) =>
        getDocs(query(col, where('__name__', 'in', batch))),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const docs: ExecucaoDoc[] = [];
        for (const snap of results) {
          for (const d of snap.docs) {
            const data = d.data();
            docs.push({
              id: d.id,
              treinamentoId: data.treinamentoId as string,
              dataAplicacao: data.dataAplicacao as ExecucaoDoc['dataAplicacao'],
              status: data.status as string,
              deletadoEm: data.deletadoEm,
            });
          }
        }
        setExecucoes(docs.filter((e) => e.deletadoEm == null));
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      });

    return () => { cancelled = true; };
  }, [labId, participacoes]);

  // Fetch treinamento titles
  useEffect(() => {
    if (!labId || execucoes.length === 0) {
      setTreinamentosMap(new Map());
      setLoading(false);
      return;
    }

    const treinIds = [...new Set(execucoes.map((e) => e.treinamentoId))];
    const col = collection(db, 'educacaoContinuada', labId, 'treinamentos');

    const batches: string[][] = [];
    for (let i = 0; i < treinIds.length; i += 30) {
      batches.push(treinIds.slice(i, i + 30));
    }

    let cancelled = false;

    Promise.all(
      batches.map((batch) =>
        getDocs(query(col, where('__name__', 'in', batch))),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, TreinamentoDoc>();
        for (const snap of results) {
          for (const d of snap.docs) {
            const data = d.data();
            map.set(d.id, {
              id: d.id,
              titulo: data.titulo as string,
              cargaHoraria: (data.cargaHoraria as number) ?? 0,
            });
          }
        }
        setTreinamentosMap(map);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [labId, execucoes]);

  // Derive final list
  const treinamentos = useMemo((): TreinamentoRealizado[] => {
    const results: TreinamentoRealizado[] = [];
    for (const exec of execucoes) {
      const trein = treinamentosMap.get(exec.treinamentoId);
      if (!trein) continue;
      results.push({
        titulo: trein.titulo,
        dataRealizacao: exec.dataAplicacao?.toDate() ?? null,
        cargaHoraria: trein.cargaHoraria,
        resultado: exec.status === 'realizado' ? 'aprovado' : exec.status,
        certificadoUrl: undefined,
      });
    }
    results.sort((a, b) => {
      if (!a.dataRealizacao) return 1;
      if (!b.dataRealizacao) return -1;
      return b.dataRealizacao.getTime() - a.dataRealizacao.getTime();
    });
    return results;
  }, [execucoes, treinamentosMap]);

  // Calculate hours for current year
  const horasAno = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return treinamentos
      .filter((t) => t.dataRealizacao && t.dataRealizacao.getFullYear() === currentYear)
      .reduce((sum, t) => sum + t.cargaHoraria, 0);
  }, [treinamentos]);

  return { treinamentos, horasAno, loading, error };
}
