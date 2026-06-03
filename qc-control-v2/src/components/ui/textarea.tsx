'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const textareaId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label
          htmlFor={textareaId}
          className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          {label}
        </label>
        <div
          className={cn(
            'px-4 border rounded flex transition-colors',
            error ? 'border-error' : 'border-border-variant focus-within:border-primary focus-within:border-2',
          )}
        >
          <textarea
            ref={ref}
            id={textareaId}
            className="w-full bg-transparent outline-none text-sm py-3 min-h-[96px] resize-y"
            {...props}
          />
        </div>
        {error && <span className="text-xs text-error mt-1">{error}</span>}
        {helperText && !error && <span className="text-xs text-on-surface-variant mt-1">{helperText}</span>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
