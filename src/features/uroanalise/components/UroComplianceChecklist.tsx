import React from 'react';

export type UroComplianceStatus = 'pass' | 'fail' | 'warn' | 'pending' | 'na';

export interface UroComplianceItem {
  id: string;
  requirement: string;
  reference?: string;
  status: UroComplianceStatus;
  evidence?: string;
  remediation?: string;
}

export interface UroComplianceChecklistProps {
  items: UroComplianceItem[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
}

export const URO_COMPLIANCE_REFERENCES = {
  validadeControle: 'RDC 978 Art.117',
  controleObrigatorio: 'RDC 978 Art.121',
  acaoCorretiva: 'RDC 978 Art.128',
  notivisaPrazo: 'RDC 67/2009 Art.4',
  notivisaProtocolo: 'RDC 551/2021',
  assinaturaRT: 'DICQ 4.1.2',
  rastreabilidade: 'RDC 36/2015',
  validadeTira: 'RDC 302/2005',
} as const;

interface StatusVisual {
  label: string;
  ariaLabel: string;
  iconBg: string;
  pillBg: string;
  pillText: string;
}

const STATUS_VISUAL: Record<UroComplianceStatus, StatusVisual> = {
  pass: {
    label: 'Conforme',
    ariaLabel: 'Conforme',
    iconBg: 'bg-emerald-500',
    pillBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    pillText: 'text-emerald-700 dark:text-emerald-300',
  },
  fail: {
    label: 'Não conforme',
    ariaLabel: 'Não conforme',
    iconBg: 'bg-red-500',
    pillBg: 'bg-red-500/10 dark:bg-red-500/15',
    pillText: 'text-red-700 dark:text-red-300',
  },
  warn: {
    label: 'Atenção',
    ariaLabel: 'Atenção',
    iconBg: 'bg-amber-500',
    pillBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    pillText: 'text-amber-700 dark:text-amber-300',
  },
  pending: {
    label: 'Pendente',
    ariaLabel: 'Pendente',
    iconBg: 'bg-slate-300 dark:bg-white/15',
    pillBg: 'bg-slate-200/60 dark:bg-white/[0.06]',
    pillText: 'text-slate-600 dark:text-white/55',
  },
  na: {
    label: 'N/A',
    ariaLabel: 'Não aplicável',
    iconBg: 'bg-slate-200 dark:bg-white/10',
    pillBg: 'bg-slate-200/40 dark:bg-white/[0.04]',
    pillText: 'text-slate-500 dark:text-white/40',
  },
};

function StatusIcon({ status }: { status: UroComplianceStatus }) {
  const visual = STATUS_VISUAL[status];
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${visual.iconBg}`}
      role="img"
      aria-label={visual.ariaLabel}
    >
      {status === 'pass' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2L4.8 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {status === 'fail' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      )}
      {status === 'warn' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M6 2.5V7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="6" cy="9" r="0.9" fill="currentColor" />
        </svg>
      )}
      {status === 'pending' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="1.6" fill="currentColor" />
        </svg>
      )}
      {status === 'na' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 6H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M2 5H8M8 5L5.5 2.5M8 5L5.5 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-white/[0.04] last:border-b-0 animate-pulse motion-reduce:animate-none">
      <span className="h-6 w-6 shrink-0 rounded-full bg-slate-200 dark:bg-white/[0.08]" />
      <div className="flex-1 space-y-2">
        <span className="block h-3 w-3/4 rounded bg-slate-200 dark:bg-white/[0.08]" />
        <span className="block h-2.5 w-1/3 rounded bg-slate-100 dark:bg-white/[0.05]" />
      </div>
      <span className="h-5 w-16 shrink-0 rounded-full bg-slate-200 dark:bg-white/[0.08]" />
    </div>
  );
}

export function UroComplianceChecklist({
  items,
  title = 'Conformidade regulatória',
  subtitle,
  loading = false,
  className = '',
}: UroComplianceChecklistProps) {
  const total = items.length;
  const passed = items.filter((i) => i.status === 'pass').length;

  return (
    <section className={`w-full ${className}`}>
      <header className="flex items-end justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">{subtitle}</p>
          )}
        </div>
        {!loading && total > 0 && (
          <span className="text-xs tabular-nums text-slate-400 dark:text-white/30 shrink-0">
            {passed} passados / {total} total
          </span>
        )}
      </header>

      {loading ? (
        <div role="list" aria-busy="true" aria-label="Carregando requisitos">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-white/35 text-center py-6">
          Sem requisitos a verificar.
        </p>
      ) : (
        <ul role="list" className="w-full">
          {items.map((item) => {
            const visual = STATUS_VISUAL[item.status];
            const showRemediation =
              (item.status === 'fail' || item.status === 'warn') && item.remediation;

            return (
              <li
                key={item.id}
                role="listitem"
                className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-white/[0.04] last:border-b-0"
              >
                <StatusIcon status={item.status} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 dark:text-white/85 leading-tight">
                    {item.requirement}
                  </p>
                  {item.reference && (
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-white/30 mt-0.5">
                      {item.reference}
                    </p>
                  )}
                  {item.evidence && (
                    <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                      {item.evidence}
                    </p>
                  )}
                  {showRemediation && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-start gap-1.5">
                      <span className="mt-0.5">
                        <ArrowIcon />
                      </span>
                      <span>
                        <span className="font-semibold">Ação: </span>
                        {item.remediation}
                      </span>
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${visual.pillBg} ${visual.pillText}`}
                >
                  {visual.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default UroComplianceChecklist;
