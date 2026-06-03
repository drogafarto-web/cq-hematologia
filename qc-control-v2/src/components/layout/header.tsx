'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  userName: string
  onSignOut: () => void
}

export function Header({ userName, onSignOut }: HeaderProps) {
  const pathname = usePathname()

  const links = [
    { href: '/qc', label: 'Controle' },
    { href: '/controles', label: 'Hub' },
  ]

  return (
    <header className="h-12 border-b border-border px-6 flex items-center justify-between bg-white sticky top-0 z-10">
      <div className="flex items-center gap-6">
        <Link href="/qc" className="font-semibold text-primary text-sm">
          QC Control
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium relative',
                  active ? 'text-primary' : 'text-on-surface-variant hover:text-primary',
                )}
              >
                {l.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-on-surface-variant">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-on-surface-variant hover:text-error p-1"
          title="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
