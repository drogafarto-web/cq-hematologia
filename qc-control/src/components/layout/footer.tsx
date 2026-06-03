interface FooterProps {
  children?: React.ReactNode
}

export function Footer({ children }: FooterProps) {
  return (
    <footer className="h-8 border-t border-border px-6 flex items-center justify-between text-xs text-on-surface-variant">
      <div>{children}</div>
      <div className="flex items-center gap-3">
        <span className="hover:text-primary cursor-pointer">Export PDF</span>
        <span className="text-border-variant">·</span>
        <span className="hover:text-primary cursor-pointer">Export Excel</span>
      </div>
    </footer>
  )
}
