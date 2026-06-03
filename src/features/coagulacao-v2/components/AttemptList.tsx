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
    return (
      <div className="py-8 text-center text-sm text-[var(--cl-text-muted)]">Carregando...</div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--cl-text-faint)]">
        Nenhuma tentativa registrada
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attempts.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-[var(--cl-text-faint)]">
              #{att.id.slice(0, 6)}
            </span>
            <span className="text-sm text-[var(--cl-text-body)]">{att.controlOperacionalId}</span>
            <div className="flex gap-3 font-mono text-xs tabular-nums text-[var(--cl-text-muted)]">
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
              className="rounded bg-[var(--cl-success-bg)] px-3 py-1 text-xs text-[var(--cl-success)] hover:opacity-80"
            >
              Aprovar
            </button>
            <button
              type="button"
              onClick={() => onRejeitar(att)}
              className="rounded bg-[var(--cl-danger-bg)] px-3 py-1 text-xs text-[var(--cl-danger)] hover:opacity-80"
            >
              Rejeitar
            </button>
            <button
              type="button"
              onClick={() => onNotivisa(att)}
              className="rounded bg-[var(--cl-accent-muted)] px-3 py-1 text-xs text-[var(--cl-accent)] hover:opacity-80"
            >
              NOTIVISA
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
