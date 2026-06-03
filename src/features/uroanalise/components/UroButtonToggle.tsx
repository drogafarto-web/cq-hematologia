import React, { useRef } from 'react';

export interface UroToggleOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface UroButtonToggleProps<T extends string> {
  options: ReadonlyArray<UroToggleOption<T>>;
  value: T | null | undefined;
  onChange: (value: T) => void;
  label?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function UroButtonToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  size = 'md',
  disabled,
  className = '',
}: UroButtonToggleProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const enabledIndices = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const currentPos = enabledIndices.indexOf(index);
    let nextPos = currentPos;
    if (e.key === 'ArrowLeft')
      nextPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
    if (e.key === 'ArrowRight') nextPos = (currentPos + 1) % enabledIndices.length;
    if (e.key === 'Home') nextPos = 0;
    if (e.key === 'End') nextPos = enabledIndices.length - 1;
    const nextIndex = enabledIndices[nextPos];
    const nextOption = options[nextIndex];
    if (nextOption) {
      onChange(nextOption.value);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  const padding = size === 'sm' ? 'px-2.5 py-1.5 min-w-[44px]' : 'px-3.5 py-2.5 min-w-[52px]';
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/45">
          {label}
        </span>
      )}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel ?? label}
        aria-disabled={disabled || undefined}
        className={`flex flex-wrap gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        {options.map((opt, i) => {
          const isSelected = value === opt.value;
          const isDisabled = disabled || opt.disabled;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || (!value && i === 0) ? 0 : -1}
              disabled={isDisabled}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              title={opt.hint}
              className={[
                'rounded-lg border font-semibold uppercase tracking-wide',
                'transition-all duration-150 ease-out',
                'active:scale-[0.96] motion-reduce:active:scale-100',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
                padding,
                text,
                isSelected
                  ? 'bg-amber-500/[0.12] border-amber-500/50 text-amber-700 dark:text-amber-300'
                  : 'bg-transparent border-slate-200 dark:border-white/[0.09] text-slate-600 dark:text-white/55 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-800 dark:hover:text-white/80',
                isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
