'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label
          htmlFor={selectId}
          className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          {label}
        </label>
        <div
          className={cn(
            'h-12 px-4 border rounded flex items-center transition-colors relative',
            error
              ? 'border-error'
              : 'border-border-variant focus-within:border-primary focus-within:border-2',
          )}
        >
          <select
            ref={ref}
            id={selectId}
            className="w-full h-full bg-transparent outline-none text-sm appearance-none pr-8"
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        {error && <span className="text-xs text-error mt-1">{error}</span>}
      </div>
    );
  },
);

Select.displayName = 'Select';
