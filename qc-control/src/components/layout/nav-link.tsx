'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'text-sm transition-colors pb-1',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-on-surface-variant hover:text-primary',
      )}
    >
      {children}
    </Link>
  );
}
