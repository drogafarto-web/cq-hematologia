import React from 'react';
import type { CoagulacaoRun } from '../types/Coagulacao';
import type { CoagLotStatus } from '../types/_shared_refs';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CoagulacaoIndicadoresProps {
  runs: CoagulacaoRun[];
  lotStatus: CoagLotStatus;
}

type Variant = 'neutral' | 'ok' | 'warn' | 'danger';

const VARIANT_ACCENT: Record<Variant, string> = {
  neutral: 'bg-slate-400',
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
};

const VARIANT_VALUE: Record<Variant, string> = {
  neutral: 'text-slate-900 dark:text-white',
  ok: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};

const VARIANT_SUB: Record<Variant, string> = {
  neutral: 'text-slate-400 dark:text-slate-500',
  ok: 'text-emerald-600/70 dark:text-emerald-500/60',
  warn: 'text-amber-600/70 dark:text-amber-500/60',
  danger: 'text-red-500/70 dark:text-red-400/60',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub: string | null;
  variant: Variant;
}) {
  return (
    <div className="relative bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 overflow-hidden shadow-sm dark:shadow-none">
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${VARIANT_ACCENT[variant]}`}
      />
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
        {label}
      </div>
      <div
        className={`text-[28px] font-semibold leading-none tracking-tight tabular-nums ${VARIANT_VALUE[variant]}`}
      >
        {value}
      </div>
      {sub && <div className={`mt-2.5 text-xs ${VARIANT_SUB[variant]}`}>{sub}</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CoagulacaoIndicadores — KPIs agregados sobre os runs de um lote de coagulação.
 *
 * Mostra:
 *  - Total de corridas.
 *  - Taxa de rejeição (conformidade 'R').
 *  - Não conformes no lote (com CTA implícita por variant).
 *  - Data da última corrida.
 *  - NOTIVISA pendentes (condicional) — só aparece se houver NC sem classificação.
 */
export function CoagulacaoIndicadores({ runs, lotStatus }: CoagulacaoIndicadoresProps) {
  if (runs.length === 0) return null;

  const total = runs.length;
  const rejCount = runs.filter((r) => r.conformidade === 'R').length;
  const taxaRej = (rejCount / total) * 100;
  const ncRuns = runs.filter((r) => r.conformidade === 'R');
  const ncCount = ncRuns.length;
  const ultima = [...runs].sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao))[0];

  const notivisaPendentes = ncRuns.filter(
    (r) => !r.notivisaStatus || r.notivisaStatus === 'pendente',
  ).length;

  const indicators: Array<{ label: string; value: string; sub: string | null; variant: Variant }> =
    [
      {
        label: 'Total corridas',
        value: String(total),
        sub: lotStatus === 'sem_dados' ? 'aguardando primeiro registro' : `lote ${lotStatus}`,
        variant: 'neutral',
      },
      {
        label: 'Taxa de rejeição',
        value: `${taxaRej.toFixed(1)}%`,
        sub: `${rejCount} de ${total} corridas`,
        variant: taxaRej > 10 ? 'danger' : taxaRej > 5 ? 'warn' : 'ok',
      },
      {
        label: 'Não conformes',
        value: String(ncCount),
        sub: ncCount > 0 ? 'requer ação corretiva' : 'sem NC no lote',
        variant: ncCount > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Última corrida',
        value: ultima ? fmtDate(ultima.dataRealizacao) : '—',
        sub: ultima ? (ultima.conformidade === 'A' ? 'Conforme' : 'Não conforme') : null,
        variant: ultima ? (ultima.conformidade === 'A' ? 'ok' : 'warn') : 'neutral',
      },
    ];

  if (notivisaPendentes > 0) {
    indicators.push({
      label: 'NOTIVISA pendentes',
      value: String(notivisaPendentes),
      sub: 'classificar e notificar (RDC 551/2021)',
      variant: 'danger',
    });
  }

  return (
    <div
      className={`grid grid-cols-2 gap-4 ${notivisaPendentes > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}
    >
      {indicators.map((ind) => (
        <KpiCard key={ind.label} {...ind} />
      ))}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
