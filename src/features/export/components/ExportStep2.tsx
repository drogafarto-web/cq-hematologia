/**
 * ExportStep2 — Date range selection step
 * Uses native <input type="date"> — no external date library.
 */

interface ExportStep2Props {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

/** ISO today string: YYYY-MM-DD */
function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** ISO date 90 days ago */
function ninetyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

export function ExportStep2({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: ExportStep2Props) {
  const today = todayIso();
  const defaultStart = ninetyDaysAgoIso();

  const hasError =
    startDate && endDate && startDate > endDate;

  const daysDiff =
    startDate && endDate
      ? Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-white/50 leading-relaxed">
        Defina o período de dados a incluir na exportação. Recomendamos períodos
        de até 90 dias para exportações mais ágeis.
      </p>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Últimos 30 dias', days: 30 },
          { label: 'Últimos 60 dias', days: 60 },
          { label: 'Últimos 90 dias', days: 90 },
        ].map(({ label, days }) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              const end = todayIso();
              const start = new Date();
              start.setDate(start.getDate() - days);
              onStartDateChange(start.toISOString().split('T')[0]);
              onEndDateChange(end);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/50 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white/70 transition-colors duration-150"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="export-start-date"
            className="text-xs font-medium text-white/60 tracking-wide uppercase"
          >
            Data inicial
          </label>
          <input
            id="export-start-date"
            type="date"
            value={startDate}
            max={endDate || today}
            placeholder={defaultStart}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={[
              'w-full rounded-lg px-3 py-2.5 text-sm text-white',
              'bg-white/[0.06] ring-1 transition-all duration-150',
              'focus:outline-none focus:ring-2',
              hasError
                ? 'ring-red-500/50 focus:ring-red-500/70'
                : 'ring-white/10 focus:ring-violet-500/60',
              '[color-scheme:dark]',
            ].join(' ')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="export-end-date"
            className="text-xs font-medium text-white/60 tracking-wide uppercase"
          >
            Data final
          </label>
          <input
            id="export-end-date"
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={[
              'w-full rounded-lg px-3 py-2.5 text-sm text-white',
              'bg-white/[0.06] ring-1 transition-all duration-150',
              'focus:outline-none focus:ring-2',
              hasError
                ? 'ring-red-500/50 focus:ring-red-500/70'
                : 'ring-white/10 focus:ring-violet-500/60',
              '[color-scheme:dark]',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Validation feedback */}
      {hasError && (
        <p className="flex items-center gap-1.5 text-xs text-red-400" role="alert">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
              clipRule="evenodd"
            />
          </svg>
          Data inicial deve ser anterior à data final
        </p>
      )}

      {/* Period summary */}
      {daysDiff !== null && daysDiff > 0 && !hasError && (
        <p className="text-xs text-white/40">
          Período selecionado:{' '}
          <span className="text-white/60 font-medium tabular-nums">{daysDiff}</span>{' '}
          {daysDiff === 1 ? 'dia' : 'dias'}
          {daysDiff > 90 && (
            <span className="ml-2 text-amber-400">
              — períodos longos podem demorar mais para processar
            </span>
          )}
        </p>
      )}
    </div>
  );
}
