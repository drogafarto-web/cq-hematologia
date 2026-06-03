import React, { useMemo } from 'react';
import { UroInputField } from './UroInputField';

type ConformidadeRow = 'conforme' | 'desvio' | 'pendente' | 'sem_avaliar';

interface UroQuantitativoRowProps {
  analitoId: 'ph' | 'densidade';
  label: string;
  value: number | null | undefined;
  expectedRange?: { min: number; max: number };
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  conformidade?: ConformidadeRow;
  required?: boolean;
  disabled?: boolean;
  origem?: 'MANUAL' | 'OCR_ACEITO' | 'OCR_EDITADO' | 'OCR_REJEITADO';
  ocrConfianca?: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}

const STATUS_DOT: Record<ConformidadeRow, { color: string; label: string }> = {
  conforme: { color: 'bg-emerald-500', label: 'Conforme' },
  desvio: { color: 'bg-red-500', label: 'Desvio' },
  pendente: { color: 'bg-amber-500', label: 'Pendente' },
  sem_avaliar: { color: 'bg-slate-300 dark:bg-white/15', label: 'Sem dado' },
};

const DEFAULTS_BY_ANALITO: Record<
  UroQuantitativoRowProps['analitoId'],
  { step: number; min: number; max: number; decimals: number }
> = {
  ph: { step: 0.5, min: 5.0, max: 8.5, decimals: 1 },
  densidade: { step: 0.005, min: 1.0, max: 1.03, decimals: 3 },
};

export function UroQuantitativoRow({
  analitoId,
  label,
  value,
  expectedRange,
  onChange,
  onBlur,
  conformidade,
  required,
  disabled,
  origem,
  ocrConfianca,
  step,
  min,
  max,
  unit,
}: UroQuantitativoRowProps) {
  const defaults = DEFAULTS_BY_ANALITO[analitoId];
  const effectiveStep = step ?? defaults.step;
  const effectiveMin = min ?? defaults.min;
  const effectiveMax = max ?? defaults.max;
  const decimals = defaults.decimals;

  // Display value: empty string when null/undefined/NaN; raw number otherwise
  // (input itself uses raw number — we don't pre-format mid-edit, only display value).
  const hasNumericValue = value !== null && value !== undefined && !Number.isNaN(value);
  const inputValue: string | number = hasNumericValue ? (value as number) : '';

  // Compute conformidade locally if not explicitly passed by caller.
  const computedConformidade: ConformidadeRow = useMemo(() => {
    if (conformidade) return conformidade;
    if (!hasNumericValue || !expectedRange) return 'sem_avaliar';
    const v = value as number;
    return v >= expectedRange.min && v <= expectedRange.max ? 'conforme' : 'desvio';
  }, [conformidade, hasNumericValue, value, expectedRange]);

  const dot = STATUS_DOT[computedConformidade];

  const isOcrLowConfidence =
    origem?.startsWith('OCR_') && typeof ocrConfianca === 'number' && ocrConfianca < 0.7;

  const formatRange = (r: { min: number; max: number }) => {
    if (r.min === r.max) return r.min.toFixed(decimals);
    return `${r.min.toFixed(decimals)}–${r.max.toFixed(decimals)}`;
  };

  const isOutOfRange =
    hasNumericValue &&
    expectedRange &&
    ((value as number) < expectedRange.min || (value as number) > expectedRange.max);

  const errorMsg =
    isOutOfRange && expectedRange ? `fora de ${formatRange(expectedRange)}` : undefined;

  const handleChange = (raw: string) => {
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(null);
      return;
    }
    let parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) {
      onChange(null);
      return;
    }
    // Densidade: operador pode digitar formato inteiro (1015) em vez de decimal (1.015).
    // Normaliza automaticamente quando o valor está na faixa típica de inteiros de tira.
    if (analitoId === 'densidade' && parsed >= 1000 && parsed <= 1100) {
      parsed = parsed / 1000;
    }
    onChange(parsed);
  };

  return (
    <div
      className="group grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-white/[0.05] last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors duration-150"
      data-analito={analitoId}
    >
      {/* Label column — matches UroAnalyteRow */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-slate-800 dark:text-white/85 leading-tight flex items-baseline gap-1">
          <span>{label}</span>
          {required && (
            <span className="text-red-500 dark:text-red-400 text-xs" aria-label="obrigatório">
              *
            </span>
          )}
        </span>
        {expectedRange && (
          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-white/35 leading-tight">
            esperado:{' '}
            <span className="text-slate-500 dark:text-white/55">{formatRange(expectedRange)}</span>
          </span>
        )}
        {isOcrLowConfidence && (
          <span className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            OCR · revisar ({Math.round((ocrConfianca ?? 0) * 100)}%)
          </span>
        )}
      </div>

      {/* Input column — bounded width so it doesn't span like categorical toggles */}
      <div className="flex flex-col gap-1 max-w-[140px]">
        <UroInputField
          type="number"
          value={inputValue}
          onChange={handleChange}
          onBlur={onBlur}
          align="right"
          step={String(effectiveStep)}
          min={effectiveMin}
          max={effectiveMax}
          inputMode="decimal"
          disabled={disabled}
          state={isOutOfRange ? 'error' : undefined}
          suffix={unit || undefined}
          ariaLabel={`Resultado de ${label}`}
          error={errorMsg}
        />
      </div>

      {/* Status dot column — matches UroAnalyteRow */}
      <div
        className="flex items-center justify-center w-6 h-6 shrink-0"
        title={dot.label}
        aria-label={dot.label}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${dot.color} ${
            computedConformidade === 'pendente' ? 'animate-pulse motion-reduce:animate-none' : ''
          }`}
        />
      </div>
    </div>
  );
}
