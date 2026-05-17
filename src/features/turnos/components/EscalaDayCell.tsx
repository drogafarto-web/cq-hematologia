import { PERIODO_LABEL, type EscalaDiaria } from '../types/Escala';

interface EscalaDayCellProps {
  day: Date;
  dayLabel: string;
  escalas: EscalaDiaria[];
  isMissing: boolean;
  isToday: boolean;
  onAdd: () => void;
  onEdit: (escala: EscalaDiaria) => void;
}

export function EscalaDayCell({ day, dayLabel, escalas, isMissing, isToday, onAdd, onEdit }: EscalaDayCellProps) {
  const dayNum = day.getDate();

  return (
    <div
      className="flex min-h-[140px] flex-col rounded-lg p-3 transition-colors"
      style={{
        background: 'var(--surface-card, #11161D)',
        border: `1px solid ${
          isToday
            ? 'var(--accent-600, #2563EB)'
            : isMissing
              ? 'rgba(239, 68, 68, 0.25)'
              : 'var(--border-soft, rgba(255,255,255,0.06))'
        }`,
      }}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="font-semibold uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text-faint, #64748B)' }}
          >
            {dayLabel}
          </span>
          <span
            className="font-semibold"
            style={{
              fontSize: '14px',
              color: isToday ? 'var(--accent-400, #60A5FA)' : 'var(--text-strong, #fff)',
            }}
          >
            {dayNum}
          </span>
        </div>
        {/* RT indicator */}
        <span
          className="h-2 w-2 rounded-full"
          style={{
            background: isMissing
              ? 'var(--danger-500, #EF4444)'
              : 'var(--success-500, #10B981)',
          }}
          title={isMissing ? 'Sem cobertura RT' : 'RT presente'}
          aria-label={isMissing ? 'Sem cobertura RT' : 'RT presente'}
        />
      </div>

      {/* Escalas */}
      <div className="flex-1 space-y-1.5">
        {escalas.map((escala) => (
          <button
            key={escala.id}
            type="button"
            onClick={() => onEdit(escala)}
            className="w-full rounded px-2 py-1.5 text-left transition-colors hover:brightness-110"
            style={{
              background: 'var(--surface-muted, #161B23)',
              border: '1px solid var(--border-hairline, rgba(255,255,255,0.04))',
            }}
          >
            <span
              className="block font-medium"
              style={{ fontSize: '11px', color: 'var(--accent-400, #60A5FA)' }}
            >
              {PERIODO_LABEL[escala.periodo] ?? escala.periodo}
            </span>
            {escala.colaboradores.length > 0 && (
              <span
                className="block truncate"
                style={{ fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}
              >
                {escala.colaboradores.map((c) => c.nome).join(', ')}
              </span>
            )}
            <div className="mt-0.5 flex items-center gap-1">
              {escala.rtPresente && (
                <span
                  className="rounded px-1 py-0.5"
                  style={{ fontSize: '9px', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: 'var(--success-500, #10B981)' }}
                >
                  RT
                </span>
              )}
              {escala.rtSubstitutoPresente && (
                <span
                  className="rounded px-1 py-0.5"
                  style={{ fontSize: '9px', fontWeight: 600, background: 'rgba(16,185,129,0.10)', color: 'rgba(16,185,129,0.7)' }}
                >
                  Sub
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 transition-colors"
        style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--text-faint, #64748B)',
          border: '1px dashed var(--border-soft, rgba(255,255,255,0.06))',
        }}
        aria-label={`Adicionar escala em ${dayLabel} ${dayNum}`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Adicionar
      </button>
    </div>
  );
}
