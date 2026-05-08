import React, { forwardRef, useId } from 'react';

type InputState = 'default' | 'error' | 'success' | 'disabled';

interface UroInputFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  suffix?: string;
  align?: 'left' | 'right';
  state?: InputState;
  step?: string;
  min?: number | string;
  max?: number | string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  ariaLabel?: string;
  className?: string;
}

const BORDER_BASE = 'border-slate-200 dark:border-white/[0.09]';
const BORDER_HOVER = 'hover:border-slate-300 dark:hover:border-white/[0.18]';
const BORDER_FOCUS = 'focus-within:border-amber-500/60 dark:focus-within:border-amber-500/50';
const BORDER_ERROR = 'border-red-400/60 dark:border-red-400/40';
const BG_LIGHT = 'bg-slate-50 dark:bg-white/[0.06]';
const BG_FOCUS = 'focus-within:bg-white dark:focus-within:bg-white/[0.08]';

export const UroInputField = forwardRef<HTMLInputElement, UroInputFieldProps>(function UroInputField(
  {
    label,
    hint,
    error,
    value,
    onChange,
    onBlur,
    onFocus,
    type = 'text',
    placeholder,
    required,
    disabled,
    loading,
    autoFocus,
    suffix,
    align = 'left',
    state,
    step,
    min,
    max,
    inputMode,
    ariaLabel,
    className = '',
  },
  ref
) {
  const id = useId();
  const isError = state === 'error' || Boolean(error);
  const isDisabled = disabled || state === 'disabled';

  const wrapperClasses = [
    'group relative flex items-center gap-2 rounded-xl border transition-all duration-150 ease-out',
    BG_LIGHT,
    BG_FOCUS,
    isError ? BORDER_ERROR : `${BORDER_BASE} ${BORDER_HOVER} ${BORDER_FOCUS}`,
    isDisabled ? 'opacity-40 pointer-events-none' : '',
    className,
  ].join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/45 flex items-baseline gap-1"
        >
          <span>{label}</span>
          {required && <span className="text-red-500 dark:text-red-400" aria-hidden>*</span>}
          {hint && !error && (
            <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-slate-400 dark:text-white/30">
              {hint}
            </span>
          )}
        </label>
      )}

      <div className={wrapperClasses}>
        <input
          ref={ref}
          id={id}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          required={required}
          disabled={isDisabled}
          autoFocus={autoFocus}
          step={step}
          min={min}
          max={max}
          inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)}
          aria-label={ariaLabel ?? label}
          aria-invalid={isError || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'w-full bg-transparent px-3.5 py-2.5 text-sm leading-none outline-none',
            'text-slate-900 dark:text-white/90',
            'placeholder:text-slate-400 dark:placeholder:text-white/20',
            align === 'right' ? 'text-right tabular-nums' : '',
            type === 'number' ? 'tabular-nums' : '',
          ].join(' ')}
        />

        {suffix && (
          <span className="pr-3.5 text-xs font-mono text-slate-400 dark:text-white/30 shrink-0 select-none">
            {suffix}
          </span>
        )}

        {loading && (
          <span
            className="pr-3.5 shrink-0"
            aria-label="Carregando"
            role="status"
          >
            <span className="block w-3 h-3 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          </span>
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="text-[11px] text-red-600 dark:text-red-400 leading-tight"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
});
