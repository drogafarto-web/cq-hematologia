import React from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface UroAuditRow {
  id: string;
  /** Código sequencial da corrida — ex: "UR-2025-0042". */
  runCode: string;
  /** Data de realização no formato YYYY-MM-DD. */
  dataRealizacao: string;
  /** Nome de exibição do operador responsável pela corrida. */
  operatorName: string;
  /** Decisão de conformidade — A = Aceitável, R = Rejeitado. */
  conformidade: 'A' | 'R';
  /** Quantidade de analitos com desvio (0 quando conformidade === 'A'). */
  desviosCount: number;
  /** Indica se a assinatura do RT foi aplicada. */
  signed: boolean;
  /** Nome do RT que assinou. */
  signedBy?: string;
  /** Timestamp unix ms da assinatura. */
  signedAt?: number;
  /** Sinaliza desvio com notivisaStatus pendente. */
  hasNotivisaPending?: boolean;
}

export interface UroAuditTableProps {
  rows: UroAuditRow[];
  loading?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, next: boolean) => void;
  onSelectAll?: (next: boolean) => void;
  onView: (id: string) => void;
  onSign: (id: string) => void;
  onBulkSign?: (ids: string[]) => void;
  className?: string;
  emptyHint?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSignedTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function joinClass(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

// ─── Ícones inline (currentColor) ─────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ConformidadePill({ row }: { row: UroAuditRow }) {
  if (row.conformidade === 'A') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums
                   bg-emerald-500/10 text-emerald-700 dark:text-emerald-300
                   border border-emerald-500/30"
      >
        Aceitável
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums
                   bg-red-500/10 text-red-700 dark:text-red-300
                   border border-red-500/30"
      >
        Rejeitado
      </span>
      {row.desviosCount > 0 && (
        <span className="text-[10px] text-slate-500 dark:text-white/40 tabular-nums">
          {row.desviosCount} {row.desviosCount === 1 ? 'desvio' : 'desvios'}
        </span>
      )}
    </span>
  );
}

function NotivisaPill({ pending }: { pending: boolean | undefined }) {
  if (!pending) {
    return (
      <span aria-label="sem pendência" className="text-slate-300 dark:text-white/20">
        .
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold
                 bg-amber-500/10 text-amber-700 dark:text-amber-300
                 border border-amber-500/30"
    >
      pendente
    </span>
  );
}

function SignatureCell({ row }: { row: UroAuditRow }) {
  if (!row.signed) {
    return (
      <span aria-label="não assinado" className="text-sm text-slate-400 dark:text-white/30">
        pendente
      </span>
    );
  }
  const time = row.signedAt ? formatSignedTime(row.signedAt) : '';
  const who = row.signedBy ?? 'RT';
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="text-emerald-500" />
        assinado
      </span>
      <span className="text-[11px] text-slate-500 dark:text-white/40 tabular-nums">
        por {who}
        {time ? ` · ${time}` : ''}
      </span>
    </span>
  );
}

function ActionButton({
  variant,
  onClick,
  children,
  ariaLabel,
}: {
  variant: 'outline' | 'primary';
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const base =
    'inline-flex items-center justify-center min-h-[44px] py-2 px-3 rounded-md text-[12px] font-semibold ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
    'focus-visible:ring-offset-transparent';
  const skin =
    variant === 'primary'
      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-500 focus-visible:ring-amber-400/70'
      : 'border border-slate-200 dark:border-white/[0.12] text-slate-700 dark:text-white/80 ' +
        'hover:bg-slate-100 dark:hover:bg-white/[0.06] focus-visible:ring-slate-400/70 dark:focus-visible:ring-white/30';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={joinClass(base, skin)}
    >
      {children}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ withCheckbox }: { withCheckbox: boolean }) {
  return (
    <tr className="border-b border-slate-100 dark:border-white/[0.04] animate-pulse motion-reduce:animate-none">
      {withCheckbox && (
        <td className="py-3 px-4 w-10">
          <div className="h-4 w-4 rounded bg-slate-200 dark:bg-white/10" />
        </td>
      )}
      <td className="py-3 px-4 w-32">
        <div className="h-3 w-20 rounded bg-slate-200 dark:bg-white/10 mb-1.5" />
        <div className="h-2 w-16 rounded bg-slate-100 dark:bg-white/[0.06]" />
      </td>
      <td className="py-3 px-4">
        <div className="h-3 w-32 rounded bg-slate-200 dark:bg-white/10" />
      </td>
      <td className="py-3 px-4 w-32">
        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-white/10" />
      </td>
      <td className="py-3 px-4 w-24">
        <div className="h-4 w-16 rounded bg-slate-100 dark:bg-white/[0.06]" />
      </td>
      <td className="py-3 px-4 w-48">
        <div className="h-3 w-28 rounded bg-slate-200 dark:bg-white/10 mb-1.5" />
        <div className="h-2 w-20 rounded bg-slate-100 dark:bg-white/[0.06]" />
      </td>
      <td className="py-3 px-4 w-32">
        <div className="h-9 w-24 rounded-md bg-slate-200 dark:bg-white/10" />
      </td>
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UroAuditTable — superfície de revisão do Responsável Técnico para o módulo
 * de uroanálise. Lista as corridas do lote ativo com conformidade, status de
 * assinatura, alertas NOTIVISA e ações inline (ver, assinar, assinar em lote).
 *
 * Layout em forma de tabela verdadeira (não card-grid), com larguras de coluna
 * consistentes e scroll horizontal em viewports estreitos.
 *
 * Compliance: RDC 978/2025 Art. 128 — assinatura do RT após registro do operador.
 */
export function UroAuditTable({
  rows,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onView,
  onSign,
  onBulkSign,
  className,
  emptyHint,
}: UroAuditTableProps) {
  const selectable = typeof onToggleSelect === 'function';
  const selected = selectedIds ?? new Set<string>();
  const selectedArray = React.useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [rows, selected],
  );
  const selectedCount = selectedArray.length;
  const allSelected = selectable && rows.length > 0 && selectedCount === rows.length;
  const someSelected = selectable && selectedCount > 0 && selectedCount < rows.length;

  const headerSelectRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (headerSelectRef.current) {
      headerSelectRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const showBulkBar = selectable && selectedCount > 0 && typeof onBulkSign === 'function';

  const headerCellBase =
    'text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-white/30 ' +
    'border-b border-slate-200 dark:border-white/[0.08] py-2 px-4 text-left';

  const checkboxClass =
    'h-4 w-4 rounded border-slate-300 dark:border-white/20 ' +
    'bg-white dark:bg-white/[0.04] text-amber-500 ' +
    'focus:ring-2 focus:ring-amber-400/70 focus:ring-offset-0 ' +
    'cursor-pointer accent-amber-500';

  return (
    <div className={joinClass('w-full', className)}>
      {showBulkBar && (
        <div
          className="sticky top-0 z-10 mt-2 mb-2 flex items-center justify-between gap-3
                     px-4 py-2 rounded-md
                     bg-amber-500/10 border border-amber-500/30
                     backdrop-blur-sm"
          role="region"
          aria-label="Ações em lote"
        >
          <span className="text-[12px] font-medium text-amber-700 dark:text-amber-200 tabular-nums">
            {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          <ActionButton
            variant="primary"
            ariaLabel={`Assinar ${selectedCount} corridas selecionadas`}
            onClick={() => onBulkSign?.(selectedArray)}
          >
            Assinar todas
          </ActionButton>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={joinClass(headerCellBase, 'w-10')}>
                  <input
                    ref={headerSelectRef}
                    type="checkbox"
                    aria-label="Selecionar todas as corridas"
                    className={checkboxClass}
                    checked={allSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    disabled={rows.length === 0 || loading}
                  />
                </th>
              )}
              <th scope="col" className={joinClass(headerCellBase, 'w-32')}>
                Run
              </th>
              <th scope="col" className={joinClass(headerCellBase, 'flex-1')}>
                Operador
              </th>
              <th scope="col" className={joinClass(headerCellBase, 'w-32')}>
                Conformidade
              </th>
              <th scope="col" className={joinClass(headerCellBase, 'w-24')}>
                NOTIVISA
              </th>
              <th scope="col" className={joinClass(headerCellBase, 'w-48')}>
                Assinatura
              </th>
              <th scope="col" className={joinClass(headerCellBase, 'w-32 text-right')}>
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={`sk-${i}`} withCheckbox={selectable} />
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={selectable ? 7 : 6}
                  className="text-sm text-slate-400 dark:text-white/35 py-12 text-center"
                >
                  {emptyHint ?? 'Nenhuma corrida neste lote.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selected.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={joinClass(
                      'border-b border-slate-100 dark:border-white/[0.04] transition-colors duration-150',
                      isSelected
                        ? 'bg-amber-500/5'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]',
                    )}
                  >
                    {selectable && (
                      <td className="py-3 px-4 w-10 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar corrida ${row.runCode}`}
                          className={checkboxClass}
                          checked={isSelected}
                          onChange={(e) => onToggleSelect?.(row.id, e.target.checked)}
                        />
                      </td>
                    )}

                    <td className="py-3 px-4 w-32 align-middle">
                      <div className="text-sm font-mono tabular-nums text-slate-900 dark:text-white/85">
                        {row.runCode}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-white/35">
                        {row.dataRealizacao}
                      </div>
                    </td>

                    <td className="py-3 px-4 align-middle">
                      <div className="text-sm text-slate-700 dark:text-white/80 truncate">
                        {row.operatorName}
                      </div>
                    </td>

                    <td className="py-3 px-4 w-32 align-middle">
                      <ConformidadePill row={row} />
                    </td>

                    <td className="py-3 px-4 w-24 align-middle">
                      <NotivisaPill pending={row.hasNotivisaPending} />
                    </td>

                    <td className="py-3 px-4 w-48 align-middle">
                      <SignatureCell row={row} />
                    </td>

                    <td className="py-3 px-4 w-32 align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <ActionButton
                          variant="outline"
                          ariaLabel={`Ver corrida ${row.runCode}`}
                          onClick={() => onView(row.id)}
                        >
                          Ver
                        </ActionButton>
                        {!row.signed && (
                          <ActionButton
                            variant="primary"
                            ariaLabel={`Assinar corrida ${row.runCode}`}
                            onClick={() => onSign(row.id)}
                          >
                            Assinar
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UroAuditTable;
