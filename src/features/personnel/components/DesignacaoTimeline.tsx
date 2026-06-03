/**
 * DesignacaoTimeline — Point 7
 *
 * Vertical timeline of role assignments (designações) for a given colaborador.
 * Reads from `personnel/{labId}/designacoes` where pessoaId == colaboradorId.
 * Visual: left border line with dots, cards to the right.
 * Violet for active (no dataFim), slate for past.
 */

import React, { useEffect, useState } from 'react';
import {
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { Designacao, LabId } from '../types';

interface DesignacaoTimelineProps {
  colaboradorId: string;
}

function formatTimestamp(ts: { toDate: () => Date } | null): string {
  if (!ts) return 'Atual';
  return ts
    .toDate()
    .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DesignacaoTimeline({ colaboradorId }: DesignacaoTimelineProps): React.ReactElement {
  const labId = useActiveLabId() as LabId | null;
  const [designacoes, setDesignacoes] = useState<Designacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!labId || !colaboradorId) {
      setDesignacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const colRef = collection(doc(db, 'personnel', labId), 'designacoes');
    const q = query(
      colRef,
      where('pessoaId', '==', colaboradorId),
      where('deletadoEm', '==', null),
      orderBy('dataInicio', 'desc'),
    );

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Designacao[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            labId: data.labId,
            cargoId: data.cargoId,
            pessoaId: data.pessoaId,
            pessoaNome: data.pessoaNome,
            dataInicio: data.dataInicio,
            dataFim: data.dataFim ?? null,
            descricaoAutoridade: data.descricaoAutoridade,
            successorId: data.successorId ?? undefined,
            chainHash: data.chainHash,
            certificadoUrl: data.certificadoUrl ?? undefined,
            criadoEm: data.criadoEm,
            updatedAt: data.updatedAt,
            deletadoEm: data.deletadoEm ?? null,
          } as Designacao;
        });
        setDesignacoes(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => unsub();
  }, [labId, colaboradorId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
        Erro ao carregar histórico: {error.message}
      </div>
    );
  }

  if (designacoes.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="text-sm text-white/50">
          Nenhuma designação registrada para este colaborador.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" aria-hidden="true" />

      <div className="space-y-4">
        {designacoes.map((d) => {
          const isActive = d.dataFim === null;
          return (
            <div key={d.id} className="relative flex items-start gap-4">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-3 h-[10px] w-[10px] rounded-full border-2 ${
                  isActive ? 'border-violet-500 bg-violet-500' : 'border-white/30 bg-[#141417]'
                }`}
                aria-hidden="true"
              />

              {/* Card */}
              <div
                className={`flex-1 rounded-lg border px-4 py-3 ${
                  isActive
                    ? 'border-violet-500/30 bg-violet-500/5'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4
                    className={`text-sm font-semibold ${isActive ? 'text-violet-300' : 'text-white/80'}`}
                  >
                    {d.descricaoAutoridade || d.cargoId}
                  </h4>
                  {isActive && (
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {formatTimestamp(d.dataInicio)} → {formatTimestamp(d.dataFim)}
                </p>
                {d.pessoaNome && <p className="mt-0.5 text-xs text-white/40">{d.pessoaNome}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
