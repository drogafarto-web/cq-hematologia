import React from 'react';
import type { CIQImunoRun } from '../types/CIQImuno';
import type { CIQLotStatus } from '../types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CIQIndicadoresProps {
  runs:      CIQImunoRun[];
  lotStatus: CIQLotStatus;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQIndicadores({ runs, lotStatus }: CIQIndicadoresProps) {
  if (runs.length === 0) return null;

  const total    = runs.length;
  const nrCount  = runs.filter((r) => r.resultadoObtido === 'NR').length;
  const ncCount  = runs.filter((r) => r.resultadoObtido !== r.resultadoEsperado).length;
  const taxaNR   = (nrCount / total) * 100;

  const sorted   = [...runs].sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao));
  const ultima   = sorted[0];

  const indicators: Array<{ label: string; value: string; sub: string | null; variant: Variant }> = [
    {
      label:   'Total corridas',
      value:   String(total),
      sub:     null,
      variant: 'neutral' as const,
    },
    {
      label:   'Taxa NR',
      value:   `${taxaNR.toFixed(1)}%`,
      sub:     `${nrCount} de ${total}`,
      variant: (taxaNR > 10 ? 'danger' : taxaNR > 5 ? 'warn' : 'ok') as Variant,
    },
    {
      label:   'Não conformes',
      value:   String(ncCount),
      sub:     ncCount > 0 ? 'requer ação corretiva' : 'sem NC no lote',
      variant: (ncCount > 0 ? 'warn' : 'ok') as Variant,
    },
    {
      label:   'Última corrida',
      value:   ultima ? fmtDate(ultima.dataRealizacao) : '—',
      sub:     ultima ? (ultima.resultadoObtido === ultima.resultadoEsperado ? 'Conforme' : 'Não conforme') : null,
      variant: (ultima
        ? (ultima.resultadoObtido === ultima.resultadoEsperado ? 'ok' : 'warn')
        : 'neutral') as Variant,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {indicators.map((ind) => (
        <IndicatorCard key={ind.label} {...ind} />
      ))}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

type Variant = 'neutral' | 'ok' | 'warn' | 'danger';

const VARIANT_CLASSES: Record<Variant, { card: string; value: string; sub: string }> = {
  neutral: {
    card:  'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.07]',
    value: 'text-slate-800 dark:text-white/85',
    sub:   'text-slate-400 dark:text-white/30',
  },
  ok: {
    card:  'bg-emerald-500/[0.04] border-emerald-500/20',
    value: 'text-emerald-700 dark:text-emerald-400',
    sub:   'text-emerald-500/70 dark:text-emerald-500/60',
  },
  warn: {
    card:  'bg-amber-500/[0.05] border-amber-500/20',
    value: 'text-amber-700 dark:text-amber-400',
    sub:   'text-amber-500/70 dark:text-amber-500/60',
  },
  danger: {
    card:  'bg-red-500/[0.05] border-red-400/20',
    value: 'text-red-700 dark:text-red-400',
    sub:   'text-red-400/70 dark:text-red-400/60',
  },
};

function IndicatorCard({
  label, value, sub, variant,
}: {
  label: string;
  value: string;
  sub: string | null;
  variant: Variant;
}) {
  const cls = VARIANT_CLASSES[variant];
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls.card}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30 mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold ${cls.value}`}>{value}</p>
      {sub && (
        <p className={`text-[10px] mt-0.5 ${cls.sub}`}>{sub}</p>
      )}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
