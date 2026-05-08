import { useState } from 'react';

import { useSupervisorPresenca } from '../hooks/useSupervisorPresenca';
import type { Turno } from '../types/Turno';

interface SupervisorPresencaActionsProps {
  turno: Turno;
}

/**
 * Inline supervisor presence controls for a turno row.
 * Renders a Check-in or Check-out button with state-derived enablement.
 *
 * RDC 978/2025 Art. 122 — supervisor presencial enforcement primitive.
 */
export function SupervisorPresencaActions({ turno }: SupervisorPresencaActionsProps) {
  const {
    presenca,
    isLoading,
    isDesignatedSupervisor,
    isCheckedIn,
    isMutating,
    checkIn,
    checkOut,
  } = useSupervisorPresenca(turno);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(
    null,
  );

  const status = presenca?.status ?? 'awaiting';
  const closed = status === 'closed';

  async function handleCheckIn() {
    setFeedback(null);
    try {
      await checkIn();
      setFeedback({ kind: 'ok', msg: 'Check-in registrado.' });
    } catch (err) {
      setFeedback({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Falha no check-in.',
      });
    }
  }

  async function handleCheckOut() {
    setFeedback(null);
    try {
      await checkOut(null);
      setFeedback({ kind: 'ok', msg: 'Check-out registrado.' });
    } catch (err) {
      setFeedback({
        kind: 'err',
        msg: err instanceof Error ? err.message : 'Falha no check-out.',
      });
    }
  }

  if (isLoading) {
    return <span className="text-xs text-slate-500">Carregando presença…</span>;
  }

  if (closed) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium tracking-wide text-slate-300">
        Encerrado
      </span>
    );
  }

  // Active checkin path — offer checkout to the supervisor who is in
  if (status === 'active') {
    if (isCheckedIn) {
      return (
        <div className="flex flex-col gap-1">
          <button
            onClick={handleCheckOut}
            disabled={isMutating}
            className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium tracking-wide text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMutating ? 'Enviando…' : 'Check-out'}
          </button>
          {feedback && (
            <span
              className={
                feedback.kind === 'ok' ? 'text-[11px] text-emerald-400' : 'text-[11px] text-red-400'
              }
            >
              {feedback.msg}
            </span>
          )}
        </div>
      );
    }
    // Some other supervisor is checked in
    return (
      <span
        className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium tracking-wide text-emerald-300"
        title={`Supervisor ativo: ${presenca?.supervisorAtivo?.nome ?? '—'}`}
      >
        Ativo · {presenca?.supervisorAtivo?.nome ?? '—'}
      </span>
    );
  }

  // awaiting / absent — only the designated supervisor sees the check-in button
  if (!isDesignatedSupervisor) {
    return (
      <span className="text-[11px] text-slate-500">Aguardando supervisor designado</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleCheckIn}
        disabled={isMutating}
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium tracking-wide text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isMutating ? 'Enviando…' : 'Check-in'}
      </button>
      {feedback && (
        <span
          className={
            feedback.kind === 'ok' ? 'text-[11px] text-emerald-400' : 'text-[11px] text-red-400'
          }
        >
          {feedback.msg}
        </span>
      )}
    </div>
  );
}
