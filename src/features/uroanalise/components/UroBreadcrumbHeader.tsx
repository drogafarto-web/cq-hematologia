import React from 'react';

export interface UroBreadcrumbHeaderProps {
  labName?: string;
  loteControle?: string;
  fabricanteControle?: string;
  nivel?: 'N' | 'P';
  runCode?: string;
  runStatus?: 'rascunho' | 'salvo' | 'assinado' | null;
  pinned?: boolean;
  setupType?: 'principal' | 'validacao_paralela' | null;
  onBackToLot?: () => void;
  onBackToList?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const CRUMB_BASE =
  'text-xs uppercase tracking-wider transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:rounded-sm';
const CRUMB_INACTIVE =
  'text-slate-500 dark:text-white/45 hover:text-slate-800 dark:hover:text-white/90';
const CRUMB_ACTIVE = 'text-amber-700 dark:text-amber-300 cursor-default';
const SEPARATOR = 'text-xs text-slate-300 dark:text-white/20 select-none';

const NIVEL_STYLE: Record<'N' | 'P', string> = {
  N: 'border-slate-300 dark:border-white/20 text-slate-600 dark:text-white/60',
  P: 'border-slate-400/50 dark:border-white/30 text-slate-800 dark:text-white/85 font-bold',
};

const STATUS_STYLE: Record<'rascunho' | 'salvo' | 'assinado', string> = {
  rascunho: 'bg-slate-200 dark:bg-white/15 text-slate-600 dark:text-white/50',
  salvo: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  assinado: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

const STATUS_LABEL: Record<'rascunho' | 'salvo' | 'assinado', string> = {
  rascunho: 'Rascunho',
  salvo: 'Salvo',
  assinado: 'Assinado',
};

function PinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function LockIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

interface CrumbProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}

function Crumb({ label, onClick, active, title }: CrumbProps) {
  if (active || !onClick) {
    return (
      <span
        className={`${CRUMB_BASE} ${active ? CRUMB_ACTIVE : 'text-slate-500 dark:text-white/45'}`}
        title={title}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CRUMB_BASE} ${CRUMB_INACTIVE}`}
      title={title}
    >
      {label}
    </button>
  );
}

function Separator() {
  return (
    <span className={SEPARATOR} aria-hidden="true">
      /
    </span>
  );
}

export function UroBreadcrumbHeader({
  labName,
  loteControle,
  fabricanteControle,
  nivel,
  runCode,
  runStatus,
  pinned,
  setupType,
  onBackToLot,
  onBackToList,
  actions,
  className,
}: UroBreadcrumbHeaderProps) {
  const hasLab = Boolean(labName);
  const hasLote = Boolean(loteControle);
  const hasRun = Boolean(runCode);

  const loteLabel = hasLote
    ? fabricanteControle
      ? `${loteControle} · ${fabricanteControle}`
      : loteControle!
    : '';

  // Active crumb = the deepest one shown. If runCode exists, run is active; else lote; else lab.
  const activeCrumb: 'lab' | 'lote' | 'run' = hasRun ? 'run' : hasLote ? 'lote' : 'lab';

  const pinnedLabel =
    setupType === 'validacao_paralela' ? 'vinculada · validação' : 'vinculada · principal';

  const wrapperClass = [
    'flex items-center justify-between gap-4 px-6 py-3',
    'border-b border-slate-200 dark:border-white/[0.08]',
    'bg-white dark:bg-[#0f1318]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  // Mobile collapsed wrapper: 2 lines on <sm
  const mobileWrapperClass = [
    'flex flex-col gap-1 px-6 py-3',
    'border-b border-slate-200 dark:border-white/[0.08]',
    'bg-white dark:bg-[#0f1318]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const NivelBadge =
    nivel != null ? (
      <span
        className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${NIVEL_STYLE[nivel]}`}
        aria-label={`Nível ${nivel}`}
      >
        {nivel}
      </span>
    ) : null;

  const StatusPill =
    runStatus != null ? (
      <span
        className={`inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${STATUS_STYLE[runStatus]}`}
      >
        {runStatus === 'assinado' ? <LockIcon /> : null}
        {STATUS_LABEL[runStatus]}
      </span>
    ) : null;

  const PinnedIndicator = pinned ? (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35"
      aria-label={pinnedLabel}
    >
      <PinIcon />
      {pinnedLabel}
    </span>
  ) : null;

  return (
    <>
      {/* Desktop / >=640px */}
      <div className={`hidden sm:flex ${wrapperClass}`}>
        <nav aria-label="Localização" className="flex items-center gap-2 min-w-0 flex-1">
          {hasLab ? (
            <>
              <Crumb
                label={labName!}
                onClick={onBackToList}
                active={activeCrumb === 'lab'}
                title={labName}
              />
            </>
          ) : null}

          {hasLote ? (
            <>
              {hasLab ? <Separator /> : null}
              <Crumb
                label={loteLabel}
                onClick={onBackToLot}
                active={activeCrumb === 'lote'}
                title={loteLabel}
              />
            </>
          ) : null}

          {hasRun ? (
            <>
              {hasLab || hasLote ? <Separator /> : null}
              <span
                className={`${CRUMB_BASE} ${CRUMB_ACTIVE} tabular-nums`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {runCode}
              </span>
              {NivelBadge}
              {StatusPill}
            </>
          ) : (
            <>
              {NivelBadge}
              {StatusPill}
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {PinnedIndicator}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {/* Mobile / <640px */}
      <div className={`flex sm:hidden ${mobileWrapperClass}`}>
        <nav aria-label="Localização" className="flex items-center gap-2 min-w-0 w-full">
          {hasLab ? (
            <Crumb
              label={labName!}
              onClick={onBackToList}
              active={activeCrumb === 'lab'}
              title={labName}
            />
          ) : null}
          {hasLote ? (
            <>
              {hasLab ? <Separator /> : null}
              <span className="truncate">
                <Crumb
                  label={loteLabel}
                  onClick={onBackToLot}
                  active={activeCrumb === 'lote'}
                  title={loteLabel}
                />
              </span>
            </>
          ) : null}
        </nav>

        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {hasRun ? (
              <span
                className={`${CRUMB_BASE} ${CRUMB_ACTIVE} tabular-nums`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {runCode}
              </span>
            ) : null}
            {NivelBadge}
            {StatusPill}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {PinnedIndicator}
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default UroBreadcrumbHeader;
