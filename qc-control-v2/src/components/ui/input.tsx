'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          {label}
        </label>
        <div
          className={cn(
            'h-12 px-4 border rounded flex items-center transition-colors',
            error
              ? 'border-error'
              : 'border-border-variant focus-within:border-primary focus-within:border-2',
          )}
        >
          <input
            ref={ref}
            id={inputId}
            className="w-full h-full bg-transparent outline-none text-sm"
            {...props}
          />
        </div>
        {error && <span className="text-xs text-error mt-1">{error}</span>}
        {helperText && !error && (
          <span className="text-xs text-on-surface-variant mt-1">{helperText}</span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
