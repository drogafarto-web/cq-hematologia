import { useState } from 'react';
import { useAttempts } from '../hooks/useAttempts';
import { ConformityBadge } from './internal/ConformityBadge';
import type { Attempt } from '../types/Attempt';

interface AttemptListProps {
  labId: string;
  onAprovar: (attempt: Attempt) => void;
  onRejeitar: (attempt: Attempt) => void;
  onNotivisa: (attempt: Attempt) => void;
}

export function AttemptList({ labId, onAprovar, onRejeitar, onNotivisa }: AttemptListProps) {
  const { attempts, isLoading } = useAttempts(labId);

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-zinc-500">Carregando...</div>;
  }

  if (attempts.length === 0) {
    return <div className="py-8 text-center text-sm text-zinc-600">Nenhuma tentativa registrada</div>;
  }

  return (
    <div className="space-y-2">
      {attempts.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">#{att.id.slice(0, 6)}</span>
            <span className="text-sm text-zinc-300">{att.controlOperacionalId}</span>
            <div className="flex gap-3 text-xs text-zinc-400">
              <span>AP {att.resultados.atividadeProtrombinica}%</span>
              <span>RNI {att.resultados.rni}</span>
              <span>TTPA {att.resultados.ttpa}s</span>
            </div>
            <ConformityBadge isConforme={att.conformidade === 'A'} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAprovar(att)}
              className="rounded bg-emerald-600/20 px-3 py-1 text-xs text-emerald-400 hover:bg-emerald-600/30"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => onRejeitar(att)}
              className="rounded bg-red-600/20 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={() => onNotivisa(att)}
              className="rounded bg-amber-600/20 px-3 py-1 text-xs text-amber-400 hover:bg-amber-600/30"
            >
              NOTIVISA
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
