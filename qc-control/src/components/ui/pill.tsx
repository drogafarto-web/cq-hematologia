import { cn } from '@/lib/utils'

interface PillProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

const variantStyles: Record<string, string> = {
  success: 'bg-success-container text-green-800',
  warning: 'bg-warning-container text-amber-900',
  error: 'bg-error-container text-red-900',
  info: 'bg-primary/10 text-primary',
  neutral: 'bg-gray-100 text-gray-500',
}

const sizeStyles: Record<string, string> = {
  sm: 'text-[11px] px-2 py-0.5',
  md: 'text-xs px-3 py-1',
}

export function Pill({ variant = 'neutral', size = 'md', children }: PillProps) {
  return (
    <span
      className={cn(
        'rounded-full font-semibold inline-flex items-center',
        variantStyles[variant],
        sizeStyles[size],
      )}
    >
      {children}
    </span>
  )
}
