/**
 * CriticosEscalacaoList
 *
 * Lists pending and recent critical-value escalations with a real-time SLA
 * indicator (RDC 978/2025 Art. 5.7.1 — target <60 min). Clicking a row opens
 * the ComunicacaoModal for acknowledgment.
 *
 * Pending = status === 'enviado'. Recent = everything else, capped at 20.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, IconAlert, IconCheck, IconClock, Skeleton } from './_ui';
import { ComunicacaoModal } from './ComunicacaoModal';
import { useCriticosEscalacoes } from '../hooks/useCriticosEscalacoes';
import { computeSlaState, formatSlaCountdown } from '../utils/slaFormat';
import type { CriticosEscalacao } from '../types';

export function CriticosEscalacaoList() {
  const { pendentes, reconhecidas, isLoading, error, acknowledge } =
    useCriticosEscalacoes();
  const [selected, setSelected] = useState<CriticosEscalacao | null>(null);

  // Live tick — drives SLA indicator updates without re-fetching Firestore.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const recent = useMemo(() => reconhecidas.slice(0, 20), [reconhecidas]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="pendentes-title">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <h2
              id="pendentes-title"
              className="text-[15px] font-semibold tracking-tight text-white"
            >
              Pendentes
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Escalações aguardando reconhecimento. SLA RDC 978 Art. 5.7.1:
              comunicação crítica em até 60 minutos.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs tabular-nums text-white/70">
            {pendentes.length}
          </span>
        </header>

        {error ? (
          <Card className="border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-200">
            <p className="font-medium">Falha ao carregar escalações</p>
            <p className="mt-1 text-red-300/80">{error.message}</p>
          </Card>
        ) : isLoading ? (
          <ListSkeleton />
        ) : pendentes.length === 0 ? (
          <PendingEmpty />
        ) : (
          <ul className="space-y-2">
            {pendentes.map((e) => (
              <EscalacaoRow
                key={e.id}
                escalacao={e}
                now={now}
                onSelect={() => setSelected(e)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-title">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <h2
              id="recent-title"
              className="text-[15px] font-semibold tracking-tight text-white"
            >
              Histórico recente
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Últimas 20 escalações reconhecidas ou canceladas.
            </p>
          </div>
        </header>

        {isLoading ? (
          <ListSkeleton />
        ) : recent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-white/40">
            Nenhuma escalação no histórico.
          </Card>
        ) : (
          <ul className="space-y-2">
            {recent.map((e) => (
              <EscalacaoRow
                key={e.id}
                escalacao={e}
                now={now}
                onSelect={() => setSelected(e)}
              />
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <ComunicacaoModal
          escalacao={selected}
          onClose={() => setSelected(null)}
          onAcknowledge={acknowledge}
        />
      )}
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  escalacao: CriticosEscalacao;
  now: number;
  onSelect: () => void;
}

function EscalacaoRow({ escalacao, now, onSelect }: RowProps) {
  const slaState = computeSlaState(escalacao, now);
  const isPending = escalacao.status === 'enviado';

  const accent =
    escalacao.status === 'reconhecido'
      ? 'emerald'
      : escalacao.status === 'cancelado'
      ? 'slate'
      : slaState.kind === 'expired'
      ? 'red'
      : slaState.kind === 'warning'
      ? 'amber'
      : 'violet';

  const accentMap: Record<
    string,
    { ring: string; text: string; bg: string; dot: string }
  > = {
    emerald: {
      ring: 'border-emerald-500/25',
      text: 'text-emerald-300',
      bg: 'bg-emerald-500/[0.04]',
      dot: 'bg-emerald-400',
    },
    slate: {
      ring: 'border-white/[0.08]',
      text: 'text-white/50',
      bg: 'bg-white/[0.02]',
      dot: 'bg-white/40',
    },
    red: {
      ring: 'border-red-500/30',
      text: 'text-red-300',
      bg: 'bg-red-500/[0.05]',
      dot: 'bg-red-400 motion-safe:animate-pulse',
    },
    amber: {
      ring: 'border-amber-500/25',
      text: 'text-amber-300',
      bg: 'bg-amber-500/[0.04]',
      dot: 'bg-amber-400',
    },
    violet: {
      ring: 'border-violet-500/25',
      text: 'text-violet-300',
      bg: 'bg-violet-500/[0.03]',
      dot: 'bg-violet-400',
    },
  };
  const a = accentMap[accent];

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={
          'group flex w-full items-center gap-4 rounded-lg border ' +
          a.ring +
          ' ' +
          a.bg +
          ' px-4 py-3 text-left transition-[background-color,border-color,transform] duration-150 ' +
          'hover:bg-white/[0.05] hover:border-white/[0.12] ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 ' +
          'motion-reduce:transition-none'
        }
        aria-label={`Abrir escalação de ${escalacao.pacienteNome}, ${escalacao.analitoId} ${escalacao.valorObtido}`}
      >
        <span className={'mt-1 h-2 w-2 shrink-0 rounded-full ' + a.dot} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <p className="truncate text-sm font-medium text-white">
              {escalacao.pacienteNome}
            </p>
            <span className="font-mono text-[11px] text-white/40">
              {escalacao.pacienteIdade} a · {escalacao.pacienteSexo}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2 text-xs text-white/60">
            <span className="font-mono">{escalacao.analitoId}</span>
            <span className="tabular-nums font-semibold text-white">
              {escalacao.valorObtido}
            </span>
            <span
              className={
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium ' +
                (escalacao.severidade === 'alta'
                  ? 'bg-red-500/15 text-red-200'
                  : 'bg-blue-500/15 text-blue-200')
              }
            >
              {escalacao.severidade}
            </span>
            <span className="truncate text-white/40">→ {escalacao.medicoNome}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <div className={'flex items-center gap-1.5 text-xs ' + a.text}>
            {escalacao.status === 'reconhecido' ? (
              <IconCheck className="h-3.5 w-3.5" />
            ) : escalacao.status === 'cancelado' ? null : slaState.kind === 'expired' ? (
              <IconAlert className="h-3.5 w-3.5" />
            ) : (
              <IconClock className="h-3.5 w-3.5" />
            )}
            <span className="font-mono tabular-nums">
              {formatSlaCountdown(slaState.elapsedMs, escalacao.sla_minutos_target)}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-white/40">
            {isPending
              ? slaState.kind === 'expired'
                ? 'SLA vencido'
                : slaState.kind === 'warning'
                ? '> 50% prazo'
                : 'em prazo'
              : escalacao.status === 'reconhecido'
              ? 'reconhecido'
              : 'cancelado'}
          </span>
        </div>
      </button>
    </li>
  );
}

function PendingEmpty() {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300">
        <IconCheck />
      </div>
      <p className="mt-3 text-sm font-medium text-white">
        Nenhuma escalação pendente
      </p>
      <p className="mt-1 text-xs text-white/50">
        Quando um valor crítico for detectado, ele aparecerá aqui para
        reconhecimento imediato.
      </p>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
