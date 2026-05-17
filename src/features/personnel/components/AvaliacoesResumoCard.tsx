/**
 * personnel/components/AvaliacoesResumoCard.tsx
 *
 * Summary card for Avaliações de Competência (cross-module read from educacaoContinuada).
 * Shows: total avaliados, % aprovados, reprovados pendentes, próximas vencendo (30 dias).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  db,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';

interface AvaliacaoDoc {
  id: string;
  resultado: string;
  proximaAvaliacaoEm?: { toDate: () => Date };
  deletadoEm: unknown;
}

export function AvaliacoesResumoCard(): React.ReactElement | null {
  const labId = useActiveLabId();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!labId) {
      setAvaliacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = collection(db, 'educacaoContinuada', labId, 'avaliacoesCompetencia');
    const q = query(col, where('deletadoEm', '==', null));

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AvaliacaoDoc[];
        setAvaliacoes(items);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [labId]);

  const stats = useMemo(() => {
    const total = avaliacoes.length;
    const aprovados = avaliacoes.filter((a) => a.resultado === 'aprovado').length;
    const reprovados = avaliacoes.filter((a) => a.resultado === 'reprovado').length;

    const now = Date.now();
    const threshold = 30 * 24 * 60 * 60 * 1000;
    const vencendo = avaliacoes.filter((a) => {
      if (!a.proximaAvaliacaoEm) return false;
      const prox = a.proximaAvaliacaoEm.toDate().getTime();
      return prox > now && prox - now <= threshold;
    }).length;

    const pctAprovados = total > 0 ? Math.round((aprovados / total) * 100) : 0;

    return { total, aprovados, reprovados, vencendo, pctAprovados };
  }, [avaliacoes]);

  if (!labId) return null;

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (stats.total === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium uppercase tracking-wider text-white/40">
        Resumo de Avaliações de Competência
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            Total avaliados
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {stats.total}
          </p>
        </div>

        {/* Aprovados */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/70">
            Aprovados
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
            {stats.pctAprovados}%
          </p>
          <p className="text-[10px] text-emerald-300/50">{stats.aprovados} de {stats.total}</p>
        </div>

        {/* Reprovados */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-red-300/70">
            Reprovados
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-300">
            {stats.reprovados}
          </p>
          <p className="text-[10px] text-red-300/50">pendentes de retreinamento</p>
        </div>

        {/* Vencendo */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-amber-300/70">
            Vencendo (30d)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-300">
            {stats.vencendo}
          </p>
          <p className="text-[10px] text-amber-300/50">reavaliação necessária</p>
        </div>
      </div>
    </div>
  );
}
