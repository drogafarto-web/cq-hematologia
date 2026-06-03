'use client'

import Link from 'next/link'
import { NavLink } from './nav-link'
import { cn } from '@/lib/utils'

interface HeaderProps {
  user?: {
    name?: string | null
    email?: string | null
  } | null
  onLogout?: () => void
}

const navItems = [
  { href: '/qc', label: 'QC' },
  { href: '/lots', label: 'Lotes' },
  { href: '/corrective-actions', label: 'Ações Corretivas' },
  { href: '/analyzers', label: 'Analisadores' },
  { href: '/reports', label: 'Relatórios' },
]

const hiddenMobile = ['/corrective-actions', '/analyzers', '/reports']

export function Header({ user, onLogout }: HeaderProps) {
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'

  return (
    <header className="sticky top-0 h-12 bg-white border-b border-border px-6 z-30">
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/qc" className="font-semibold text-primary text-sm">
            QC Control
          </Link>
          <nav className="flex items-center gap-5">
            {navItems.map((item) => (
              <div
                key={item.href}
                className={cn(hiddenMobile.includes(item.href) && 'hidden md:block')}
              >
                <NavLink href={item.href}>{item.label}</NavLink>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user?.name && (
            <>
              <span className="text-sm text-on-surface-variant hidden sm:block">{user.name}</span>
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            </>
          )}
          {onLogout && (
            <button onClick={onLogout} className="text-sm text-error hover:underline">
              Sair
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
