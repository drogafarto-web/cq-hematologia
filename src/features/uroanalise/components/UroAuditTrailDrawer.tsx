import { useEffect, useRef } from 'react';

export type UroAuditEventType =
  | 'run_created'
  | 'run_updated'
  | 'run_signed'
  | 'run_rejected'
  | 'lot_pinned'
  | 'lot_unpinned'
  | 'lot_decision'
  | 'notivisa_submitted'
  | 'notivisa_dispensed'
  | 'override_applied';

export interface UroAuditEvent {
  id: string;
  type: UroAuditEventType;
  ts: number;
  operatorName: string;
  operatorRole?: string;
  signatureHash?: string;
  description?: string;
  diff?: { field: string; from?: string; to?: string }[];
}

export interface UroAuditTrailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  events: UroAuditEvent[];
  loading?: boolean;
  emptyHint?: string;
}

const EVENT_LABELS: Record<UroAuditEventType, string> = {
  run_created: 'Corrida criada',
  run_updated: 'Corrida atualizada',
  run_signed: 'Corrida assinada',
  run_rejected: 'Corrida rejeitada',
  lot_pinned: 'Lote vinculado à bancada',
  lot_unpinned: 'Lote desvinculado',
  lot_decision: 'Decisão do RT registrada',
  notivisa_submitted: 'Notificado ao NOTIVISA',
  notivisa_dispensed: 'NOTIVISA dispensado',
  override_applied: 'Override aplicado',
};

function dotColorFor(type: UroAuditEventType): string {
  switch (type) {
    case 'run_signed':
    case 'lot_decision':
      return 'bg-amber-500';
    case 'run_rejected':
      return 'bg-red-500';
    case 'notivisa_submitted':
      return 'bg-emerald-500';
    default:
      return 'bg-slate-400 dark:bg-white/30';
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;

  const target = new Date(ts);
  const today = new Date(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const hh = pad2(target.getHours());
  const mm = pad2(target.getMinutes());

  if (sameDay(target, today)) return `hoje ${hh}:${mm}`;
  if (sameDay(target, yest)) return `ontem ${hh}:${mm}`;

  const dd = pad2(target.getDate());
  const mo = pad2(target.getMonth() + 1);
  return `${dd}/${mo} ${hh}:${mm}`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 8) return hash;
  return `${hash.slice(0, 4)}…${hash.slice(-3)}`;
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block mx-1 align-[-1px] text-slate-400 dark:text-white/40"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <li className="relative pl-6 mb-5">
      <span className="absolute left-0 top-1.5 inline-block h-2 w-2 rounded-full bg-slate-200 dark:bg-white/10" />
      <div className="space-y-2 animate-pulse motion-reduce:animate-none">
        <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-2.5 w-1/3 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-2.5 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
      </div>
    </li>
  );
}

export function UroAuditTrailDrawer({
  open,
  onClose,
  title = 'Trilha de auditoria',
  subtitle,
  events,
  loading = false,
  emptyHint,
}: UroAuditTrailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const titleId = 'uro-audit-drawer-title';

  // ESC closes + Tab focus trap inside the dialog
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus close button on open
  useEffect(() => {
    if (open) {
      // defer to next tick so transform/visibility settled
      const id = window.setTimeout(() => closeRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const showEmpty = !loading && events.length === 0;

  return (
    <div
      className={`fixed inset-0 z-40 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed top-0 right-0 h-full w-full lg:w-[420px] bg-white dark:bg-[#0f1318] border-l border-slate-200 dark:border-white/[0.08] transition-transform duration-300 ease-out motion-reduce:transition-none flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.08]">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-sm font-semibold text-slate-900 dark:text-white/90 truncate"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-white/35 truncate mt-0.5">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar trilha de auditoria"
            className="inline-flex items-center justify-center h-11 w-11 -mr-2 rounded-lg text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white/90 hover:bg-slate-100 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 transition-colors motion-reduce:transition-none"
          >
            <CloseIcon />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <ul className="border-l border-slate-200 dark:border-white/10 ml-1">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </ul>
          ) : showEmpty ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-white/35 text-center px-6">
                {emptyHint ?? 'Sem eventos registrados.'}
              </p>
            </div>
          ) : (
            <ul className="border-l border-slate-200 dark:border-white/10 ml-1">
              {events.map((ev) => {
                const label = EVENT_LABELS[ev.type];
                return (
                  <li key={ev.id} className="relative pl-4 mb-5">
                    <span
                      className={`absolute -left-[5px] top-1.5 inline-block h-2 w-2 rounded-full ${dotColorFor(
                        ev.type,
                      )}`}
                      aria-hidden="true"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-white/90">
                        {label}
                      </p>
                      <time
                        dateTime={new Date(ev.ts).toISOString()}
                        className="shrink-0 text-[11px] font-mono tabular-nums text-slate-400 dark:text-white/35"
                      >
                        {formatRelative(ev.ts)}
                      </time>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                      {ev.operatorName}
                      {ev.operatorRole ? (
                        <>
                          <span className="mx-1.5 text-slate-300 dark:text-white/25">·</span>
                          {ev.operatorRole}
                        </>
                      ) : null}
                    </p>

                    {ev.description ? (
                      <p className="text-xs text-slate-600 dark:text-white/65 mt-0.5">
                        {ev.description}
                      </p>
                    ) : null}

                    {ev.signatureHash ? (
                      <p className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-white/30 mt-1 truncate">
                        hash: {truncateHash(ev.signatureHash)}
                      </p>
                    ) : null}

                    {ev.diff && ev.diff.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {ev.diff.map((d, i) => (
                          <li
                            key={`${ev.id}-diff-${i}`}
                            className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-white/55"
                          >
                            <span className="text-slate-400 dark:text-white/40">{d.field}:</span>{' '}
                            <span>{d.from ?? '∅'}</span>
                            <ArrowIcon />
                            <span className="text-slate-700 dark:text-white/80">{d.to ?? '∅'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default UroAuditTrailDrawer;
