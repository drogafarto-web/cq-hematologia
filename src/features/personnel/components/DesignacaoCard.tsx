/**
 * personnel/components/DesignacaoCard.tsx
 *
 * Display designacao (appointment) with signature info.
 * Shows person, role, start date, chain-hash preview.
 */

import React, { useEffect, useState } from 'react';
import { getDesignacao } from '../services/designacaoService';
import { getCargo } from '../services/cargoService';
import { useActiveLabId } from '../../../store/useAuthStore';
import type { Cargo, Designacao } from '../types';

interface DesignacaoCardProps {
  designacaoId: string;
}

export function DesignacaoCard({ designacaoId }: DesignacaoCardProps): React.ReactElement {
  const [designacao, setDesignacao] = useState<Designacao | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const labId = useActiveLabId();

  useEffect(() => {
    if (!labId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getDesignacao(labId, designacaoId),
      // Will get cargo after we have designacao
    ])
      .then(async ([des]) => {
        if (!des) {
          setError(new Error('Designação não encontrada'));
          return;
        }
        setDesignacao(des);
        const c = await getCargo(labId, des.cargoId);
        setCargo(c);
      })
      .catch((err) => setError(err as Error))
      .finally(() => setLoading(false));
  }, [labId, designacaoId]);

  if (loading) {
    return <div className="animate-pulse text-white/50">Carregando...</div>;
  }

  if (error || !designacao) {
    return <div className="text-red-400">Erro: {error?.message || 'Não encontrado'}</div>;
  }

  const startDate = designacao.dataInicio.toDate?.() ?? new Date(0);
  const endDate = designacao.dataFim?.toDate?.() ?? null;

  return (
    <div className="space-y-4 text-sm">
      {/* Person Info */}
      <div>
        <div className="text-xs font-semibold uppercase text-white/40">Pessoa</div>
        <div className="mt-1 text-white">{designacao.pessoaNome}</div>
      </div>

      {/* Role */}
      <div>
        <div className="text-xs font-semibold uppercase text-white/40">Cargo</div>
        <div className="mt-1 text-white">{cargo?.titulo ?? designacao.cargoId}</div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold uppercase text-white/40">Data Início</div>
          <div className="mt-1 text-white tabular-nums">{startDate.toLocaleDateString('pt-BR')}</div>
        </div>
        {endDate && (
          <div>
            <div className="text-xs font-semibold uppercase text-white/40">Data Fim</div>
            <div className="mt-1 text-white tabular-nums">{endDate.toLocaleDateString('pt-BR')}</div>
          </div>
        )}
      </div>

      {/* Authority */}
      <div>
        <div className="text-xs font-semibold uppercase text-white/40">Autoridade</div>
        <div className="mt-1 max-h-24 overflow-y-auto text-white/80 text-justify">{designacao.descricaoAutoridade}</div>
      </div>

      {/* Signature */}
      <div className="rounded-lg bg-white/5 p-3">
        <div className="text-xs font-semibold uppercase text-white/40">Assinatura</div>
        <div className="mt-2 space-y-1 font-mono text-xs">
          <div className="truncate text-white/60">
            <span className="text-white/40">Operador:</span> {designacao.chainHash.operatorId}
          </div>
          <div className="truncate text-white/60">
            <span className="text-white/40">Hash:</span> {designacao.chainHash.hash}
          </div>
          <div className="text-white/60">
            <span className="text-white/40">Data:</span>{' '}
            {designacao.chainHash.ts.toDate?.().toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
        >
          Imprimir Certificado
        </button>
      </div>
    </div>
  );
}
