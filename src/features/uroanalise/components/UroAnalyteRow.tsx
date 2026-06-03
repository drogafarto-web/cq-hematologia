import React, { useMemo } from 'react';
import { UroButtonToggle, type UroToggleOption } from './UroButtonToggle';
import type { UroValorCategorico, UroAnalitoCategoricoId } from '../types/_shared_refs';

type ConformidadeRow = 'conforme' | 'desvio' | 'pendente' | 'sem_avaliar';

interface UroAnalyteRowProps {
  analitoId: UroAnalitoCategoricoId | string;
  label: string;
  scale: ReadonlyArray<UroValorCategorico>;
  value: UroValorCategorico | null | undefined;
  expected?: string;
  onChange: (value: UroValorCategorico) => void;
  conformidade?: ConformidadeRow;
  required?: boolean;
  disabled?: boolean;
  origem?: 'MANUAL' | 'OCR_ACEITO' | 'OCR_EDITADO' | 'OCR_REJEITADO';
  ocrConfianca?: number;
}

const STATUS_DOT: Record<ConformidadeRow, { color: string; label: string }> = {
  conforme: { color: 'bg-emerald-500', label: 'Conforme' },
  desvio: { color: 'bg-red-500', label: 'Desvio' },
  pendente: { color: 'bg-amber-500', label: 'Pendente' },
  sem_avaliar: { color: 'bg-slate-300 dark:bg-white/15', label: 'Sem dado' },
};

export function UroAnalyteRow({
  analitoId,
  label,
  scale,
  value,
  expected,
  onChange,
  conformidade = 'sem_avaliar',
  required,
  disabled,
  origem,
  ocrConfianca,
}: UroAnalyteRowProps) {
  const options = useMemo<ReadonlyArray<UroToggleOption<UroValorCategorico>>>(
    () => scale.map((v) => ({ value: v, label: formatScaleLabel(v) })),
    [scale],
  );

  const dot = STATUS_DOT[conformidade];
  const isOcrLowConfidence =
    origem?.startsWith('OCR_') && typeof ocrConfianca === 'number' && ocrConfianca < 0.7;

  return (
    <div
      className="group grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors duration-150"
      data-analito={analitoId}
    >
      {/* Label column */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-slate-800 dark:text-white/85 leading-tight flex items-baseline gap-1">
          <span className="capitalize">{label}</span>
          {required && (
            <span className="text-red-500 dark:text-red-400 text-xs" aria-label="obrigatório">
              *
            </span>
          )}
        </span>
        {expected && (
          <span className="text-[11px] font-mono text-slate-400 dark:text-white/35 leading-tight">
            esperado: <span className="text-slate-500 dark:text-white/55">{expected}</span>
          </span>
        )}
        {isOcrLowConfidence && (
          <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            OCR · revisar ({Math.round((ocrConfianca ?? 0) * 100)}%)
          </span>
        )}
      </div>

      {/* Scale toggle column */}
      <UroButtonToggle
        options={options}
        value={value ?? null}
        onChange={(v) => onChange(v as UroValorCategorico)}
        ariaLabel={`Resultado de ${label}`}
        size="sm"
        disabled={disabled}
      />

      {/* Status dot column */}
      <div
        className="flex items-center justify-center w-6 h-6 shrink-0"
        title={dot.label}
        aria-label={dot.label}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${dot.color} ${conformidade === 'pendente' ? 'animate-pulse motion-reduce:animate-none' : ''}`}
        />
      </div>
    </div>
  );
}

function formatScaleLabel(value: UroValorCategorico): string {
  switch (value) {
    case 'NEGATIVO':
      return 'NEG';
    case 'TRACOS':
      return 'TR';
    case 'PRESENTE':
      return 'POS';
    case 'NORMAL':
      return 'NORM';
    case 'AUMENTADO':
      return 'AUM';
    default:
      return value;
  }
}
