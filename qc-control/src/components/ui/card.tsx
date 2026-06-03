import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddingStyles: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn('border border-border rounded bg-white', paddingStyles[padding], className)}>
      {children}
    </div>
  )
}
