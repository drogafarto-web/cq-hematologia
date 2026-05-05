/**
 * ExportStep3 — Review & confirm step
 * Summarizes format + date range, shows estimated time, triggers job initiation.
 */

import type { ExportFormat } from '../types';
import { FORMAT_VARIANT_LABELS, FORMAT_ESTIMATED_MINUTES } from '../services/jobStatusCodes';

interface ExportStep3Props {
  format: ExportFormat | null;
  startDate: string;
  endDate: string;
  onConfirm: () => void;
  isLoading: boolean;
  error: string | null;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function ExportStep3({
  format,
  startDate,
  endDate,
  onConfirm,
  isLoading,
  error,
}: ExportStep3Props) {
  const estimatedMinutes = format ? FORMAT_ESTIMATED_MINUTES[format] ?? 2 : 2;
  const formatLabel = format ? FORMAT_VARIANT_LABELS[format] ?? format.toUpperCase() : '—';

  const daysDiff =
    startDate && endDate
      ? Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-white/50 leading-relaxed">
        Revise os detalhes antes de confirmar. O arquivo será gerado em segundo
        plano e ficará disponível para download na lista de exportações.
      </p>

      {/* Summary card */}
      <div className="rounded-xl ring-1 ring-white/10 bg-white/[0.04] divide-y divide-white/[0.06]">
        <SummaryRow
          label="Formato"
          value={formatLabel}
          highlight
        />
        <SummaryRow
          label="Período"
          value={`${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`}
        />
        {daysDiff !== null && (
          <SummaryRow
            label="Duração"
            value={`${daysDiff} ${daysDiff === 1 ? 'dia' : 'dias'}`}
          />
        )}
        <SummaryRow
          label="Tempo estimado"
          value={`~${estimatedMinutes} minuto${estimatedMinutes !== 1 ? 's' : ''}`}
        />
        <SummaryRow
          label="Validade do arquivo"
          value="7 dias após geração"
        />
      </div>

      {/* Error state */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-lg bg-red-500/10 px-3.5 py-3 ring-1 ring-red-500/30"
          role="alert"
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 1.999-.29 4.499-2.599 4.499H4.645c-2.309 0-3.752-2.5-2.598-4.499L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className={[
          'relative flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3',
          'text-sm font-semibold tracking-wide text-white transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
          isLoading
            ? 'bg-violet-600/40 cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700',
        ].join(' ')}
      >
        {isLoading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Iniciando exportação...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Gerar exportação
          </>
        )}
      </button>

      <p className="text-center text-xs text-white/30">
        Você receberá notificação quando o arquivo estiver pronto
      </p>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function SummaryRow({ label, value, highlight = false }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-white/40">{label}</span>
      <span
        className={[
          'text-sm font-medium tabular-nums',
          highlight ? 'text-violet-400' : 'text-white/80',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
