/* global React */
const { useState, useMemo } = React;

// ─── Icons (inline, design-system-approved) ─────────────────────────────────────
const I = {
  Dashboard: (p) => (
    <Svg {...p}>
      <path d="M3 13h7V3H3v10zm0 8h7v-6H3v6zm11 0h7V11h-7v10zm0-18v6h7V3h-7z" />
    </Svg>
  ),
  Beaker: (p) => (
    <Svg {...p}>
      <path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19l-6-10V3" />
    </Svg>
  ),
  Chart: (p) => (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </Svg>
  ),
  Clock: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  Layers: (p) => (
    <Svg {...p}>
      <path d="M12 3 2 8l10 5 10-5-10-5z" />
      <path d="M2 13l10 5 10-5M2 18l10 5 10-5" />
    </Svg>
  ),
  Shield: (p) => (
    <Svg {...p}>
      <path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3z" />
    </Svg>
  ),
  Wrench: (p) => (
    <Svg {...p}>
      <path d="M14 4a5 5 0 0 1 5.9 6.4l-2.3-2.3-2.1 2.1 2.3 2.3A5 5 0 0 1 11.4 8.6L4 16l4 4 7.4-7.4" />
    </Svg>
  ),
  Snow: (p) => (
    <Svg {...p}>
      <path d="M12 2v20M4.93 4.93l14.14 14.14M4.93 19.07 19.07 4.93M2 12h20" />
    </Svg>
  ),
  Triangle: (p) => (
    <Svg {...p}>
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r=".8" fill="currentColor" />
    </Svg>
  ),
  Books: (p) => (
    <Svg {...p}>
      <path d="M4 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V4z" />
      <path d="M20 4h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6V4z" />
    </Svg>
  ),
  Users: (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 9.5a3 3 0 1 0 0-6M21.5 20a5.5 5.5 0 0 0-3.5-5.1" />
    </Svg>
  ),
  Building: (p) => (
    <Svg {...p}>
      <path d="M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 11h.01M15 11h.01M9 14h.01M15 14h.01" />
    </Svg>
  ),
  Heart: (p) => (
    <Svg {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  ),
  Lock: (p) => (
    <Svg {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  ),
  Chat: (p) => (
    <Svg {...p}>
      <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V5z" />
    </Svg>
  ),
  Truck: (p) => (
    <Svg {...p}>
      <rect x="1" y="6" width="14" height="10" />
      <path d="M15 9h4l3 4v3h-7V9z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  ),
  Calendar: (p) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Svg>
  ),
  File: (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" />
      <path d="M14 3v6h6" />
    </Svg>
  ),
  Plus: (p) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Search: (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  Bell: (p) => (
    <Svg {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </Svg>
  ),
  Sun: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </Svg>
  ),
  Moon: (p) => (
    <Svg {...p}>
      <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
    </Svg>
  ),
  Check: (p) => (
    <Svg {...p}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  ),
  X: (p) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  Filter: (p) => (
    <Svg {...p}>
      <path d="M3 5h18M6 12h12M10 19h4" />
    </Svg>
  ),
  Download: (p) => (
    <Svg {...p}>
      <path d="M12 4v12M6 12l6 6 6-6M4 21h16" />
    </Svg>
  ),
  Upload: (p) => (
    <Svg {...p}>
      <path d="M12 20V8M6 12l6-6 6 6M4 3h16" />
    </Svg>
  ),
  More: (p) => (
    <Svg {...p}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </Svg>
  ),
  ChevR: (p) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  ChevD: (p) => (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  ChevL: (p) => (
    <Svg {...p}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  ),
  Eye: (p) => (
    <Svg {...p}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  Sync: (p) => (
    <Svg {...p}>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5M3 21v-5h5" />
    </Svg>
  ),
  Doc: (p) => (
    <Svg {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Svg>
  ),
  Pulse: (p) => (
    <Svg {...p}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </Svg>
  ),
  Camera: (p) => (
    <Svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  ),
  Star: (p) => (
    <Svg {...p}>
      <path d="m12 3 2.9 6 6.6.6-5 4.5 1.5 6.5L12 17.3 5 20.6l1.5-6.5-5-4.5L8.1 9 12 3z" />
    </Svg>
  ),
  Print: (p) => (
    <Svg {...p}>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
    </Svg>
  ),
};

function Svg({ size = 16, strokeWidth = 1.8, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// ─── Shell primitives ─────────────────────────────────────────────────────────

function Shell({ children, page, dark = false, density = 'cozy', accent }) {
  const accentStyle = accent
    ? {
        '--accent-600': accent.c600,
        '--accent-700': accent.c700,
        '--accent-500': accent.c500,
        '--accent-50': accent.c50,
        '--accent-tint': accent.tint,
      }
    : {};
  return (
    <div className={`${dark ? 'dark' : ''}`} data-density={density} style={accentStyle}>
      <div
        className="flex w-full h-full"
        style={{ background: 'var(--surface-page)', color: 'var(--text-strong)' }}
      >
        <Sidebar page={page} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar page={page} />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}

const NAV_OP = [
  { id: 'hub', label: 'Hub', icon: 'Dashboard', kbd: 'H' },
  { id: 'analyzer', label: 'Analyzer / CQI', icon: 'Pulse', kbd: 'A' },
  { id: 'corrida', label: 'Nova corrida', icon: 'Plus', kbd: 'N' },
  { id: 'historico', label: 'Histórico', icon: 'Clock', kbd: 'R' },
];
const NAV_QUAL = [
  { id: 'nc', label: 'Não conformidades', icon: 'Triangle', badge: 7 },
  { id: 'capa', label: 'CAPA', icon: 'Check' },
  { id: 'auditoria', label: 'Auditoria', icon: 'Shield' },
  { id: 'notivisa', label: 'NOTIVISA', icon: 'File', badge: 2 },
  { id: 'riscos', label: 'Riscos', icon: 'Layers' },
];
const NAV_OPS = [
  { id: 'equipamentos', label: 'Equipamentos', icon: 'Wrench' },
  { id: 'temperatura', label: 'Temperatura', icon: 'Snow' },
  { id: 'lotes', label: 'Lotes / Insumos', icon: 'Truck' },
  { id: 'treinamentos', label: 'Treinamentos', icon: 'Books' },
  { id: 'turnos', label: 'Pessoal / Turnos', icon: 'Users' },
];
const NAV_PORTAIS = [
  { id: 'portal-medico', label: 'Portal médico', icon: 'Heart' },
  { id: 'liberacao', label: 'Liberação', icon: 'Eye' },
  { id: 'lgpd', label: 'LGPD', icon: 'Lock' },
];

function Sidebar({ page = 'hub', collapsed = false }) {
  return (
    <aside
      className="shrink-0 flex flex-col"
      style={{
        width: collapsed ? 64 : 232,
        height: '100%',
        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-soft)',
      }}
    >
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <span className="brand-mark">hc</span>
        {!collapsed && (
          <div className="leading-none">
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-strong)' }}>
              hc-quality
            </div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-faint)' }}>
              cqi · v1.4
            </div>
          </div>
        )}
      </div>

      <div className="px-2 flex-1 overflow-y-auto">
        <NavGroup label="Operação" items={NAV_OP} active={page} collapsed={collapsed} />
        <NavGroup label="Qualidade" items={NAV_QUAL} active={page} collapsed={collapsed} />
        <NavGroup label="Operacional" items={NAV_OPS} active={page} collapsed={collapsed} />
        <NavGroup label="Portais" items={NAV_PORTAIS} active={page} collapsed={collapsed} />
      </div>

      {!collapsed && <UserChip />}
    </aside>
  );
}

function NavGroup({ label, items, active, collapsed }) {
  return (
    <div className="mb-3">
      {!collapsed && (
        <div
          className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-faint)' }}
        >
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavItem key={item.id} item={item} active={item.id === active} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

function NavItem({ item, active, collapsed }) {
  const Icon = I[item.icon] || I.Dashboard;
  return (
    <a
      className="group flex items-center gap-2.5 px-3 h-8 rounded-md text-[13px] cursor-pointer transition-colors"
      style={{
        background: active ? 'var(--accent-tint)' : 'transparent',
        color: active ? 'var(--accent-600)' : 'var(--text-body)',
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon size={15} strokeWidth={active ? 2 : 1.7} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className="text-[10px] tabular-nums font-mono px-1.5 py-px rounded"
              style={{ background: 'var(--danger-50)', color: 'var(--danger-500)' }}
            >
              {item.badge}
            </span>
          )}
          {item.kbd && !item.badge && (
            <kbd
              className="hidden group-hover:inline-block text-[10px] font-mono px-1 rounded"
              style={{ color: 'var(--text-faint)', background: 'var(--surface-muted)' }}
            >
              {item.kbd}
            </kbd>
          )}
        </>
      )}
    </a>
  );
}

function UserChip() {
  return (
    <div
      className="m-2 p-2.5 rounded-lg flex items-center gap-2.5"
      style={{ background: 'var(--surface-muted)' }}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, var(--accent-500), var(--accent-700))' }}
      >
        RC
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text-strong)' }}>
          Renata Coutinho
        </div>
        <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-faint)' }}>
          Bioquímica · RT
        </div>
      </div>
      <I.More size={14} />
    </div>
  );
}

function Topbar({ page = 'hub', breadcrumbs, search = true, actions }) {
  const meta = PAGE_META[page] || PAGE_META.hub;
  return (
    <header
      className="shrink-0 h-14 flex items-center px-6 gap-4"
      style={{
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <Breadcrumbs items={breadcrumbs || meta.breadcrumbs} />
      <div className="ml-auto flex items-center gap-2">
        {search && <TopSearch />}
        <SyncDot />
        <IconBtn>
          <I.Bell size={16} />
        </IconBtn>
        <IconBtn>
          <I.Sun size={16} />
        </IconBtn>
        {actions}
      </div>
    </header>
  );
}

function Breadcrumbs({ items = [] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <I.ChevR size={12} />}
          <span
            style={i === items.length - 1 ? { color: 'var(--text-strong)', fontWeight: 600 } : {}}
          >
            {it}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}

function TopSearch() {
  return (
    <div
      className="hidden xl:flex items-center gap-2 px-2.5 h-8 rounded-md w-[280px]"
      style={{ background: 'var(--surface-muted)', color: 'var(--text-muted)' }}
    >
      <I.Search size={14} />
      <input
        placeholder="Buscar corridas, lotes, NCs…"
        className="flex-1 bg-transparent outline-none text-[12px]"
        style={{ color: 'var(--text-body)' }}
      />
      <kbd
        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{ background: 'var(--surface-card)', color: 'var(--text-faint)' }}
      >
        ⌘K
      </kbd>
    </div>
  );
}

function SyncDot() {
  return (
    <div
      className="flex items-center gap-1.5 px-2 h-8 rounded-md text-[11px] font-mono"
      style={{ color: 'var(--text-muted)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success-500)' }} />
      Sincronizado
    </div>
  );
}

function IconBtn({ children, onClick }) {
  return (
    <button
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

const PAGE_META = {
  hub: { breadcrumbs: ['Labclin Centro', 'Hub'] },
  analyzer: { breadcrumbs: ['Labclin Centro', 'CQI', 'Análise'] },
  corrida: { breadcrumbs: ['Labclin Centro', 'CQI', 'Nova corrida'] },
  historico: { breadcrumbs: ['Labclin Centro', 'CQI', 'Histórico'] },
  nc: { breadcrumbs: ['Labclin Centro', 'Qualidade', 'Não conformidades'] },
  capa: { breadcrumbs: ['Labclin Centro', 'Qualidade', 'CAPA'] },
  auditoria: { breadcrumbs: ['Labclin Centro', 'Qualidade', 'Auditoria trail'] },
  notivisa: { breadcrumbs: ['Labclin Centro', 'Regulatório', 'NOTIVISA'] },
  riscos: { breadcrumbs: ['Labclin Centro', 'Qualidade', 'Riscos'] },
  equipamentos: { breadcrumbs: ['Labclin Centro', 'Operacional', 'Equipamentos'] },
  temperatura: { breadcrumbs: ['Labclin Centro', 'Operacional', 'Temperatura'] },
  lotes: { breadcrumbs: ['Labclin Centro', 'Operacional', 'Insumos / Lotes'] },
  treinamentos: { breadcrumbs: ['Labclin Centro', 'Pessoal', 'Treinamentos'] },
  turnos: { breadcrumbs: ['Labclin Centro', 'Pessoal', 'Turnos'] },
  liberacao: { breadcrumbs: ['Labclin Centro', 'Pré/Pós-analítico', 'Liberação'] },
  lgpd: { breadcrumbs: ['Labclin Centro', 'Compliance', 'LGPD'] },
  'portal-medico': { breadcrumbs: ['Labclin Centro', 'Portais', 'Portal médico'] },
};

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function Card({ children, className = '', title, actions, padded = true, style }) {
  return (
    <section
      className={`rounded-xl ${className}`}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-soft)',
        ...style,
      }}
    >
      {title && (
        <header
          className="px-4 h-11 flex items-center"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          <span
            className="text-[13px] font-semibold tracking-tight"
            style={{ color: 'var(--text-strong)' }}
          >
            {title}
          </span>
          <span className="ml-auto flex items-center gap-1">{actions}</span>
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

function Btn({ children, kind = 'primary', size = 'md', icon, className = '' }) {
  const sizes = {
    sm: 'h-7 px-2.5 text-[12px]',
    md: 'h-8 px-3 text-[12px]',
    lg: 'h-9 px-3.5 text-[13px]',
  };
  const styles = {
    primary: {
      background: 'var(--accent-600)',
      color: '#fff',
      border: '1px solid var(--accent-600)',
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-soft)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'var(--danger-500)',
      color: '#fff',
      border: '1px solid var(--danger-500)',
    },
  };
  return (
    <button
      className={`${sizes[size]} ${className} inline-flex items-center gap-1.5 rounded-md font-medium`}
      style={styles[kind]}
    >
      {icon}
      {children}
    </button>
  );
}

function Badge({ tone = 'neutral', children, dot = true }) {
  const tones = {
    neutral: { bg: 'var(--surface-muted)', fg: 'var(--text-body)', dot: 'var(--text-faint)' },
    success: { bg: 'var(--success-50)', fg: 'var(--success-500)', dot: 'var(--success-500)' },
    warning: { bg: 'var(--warning-50)', fg: 'var(--warning-500)', dot: 'var(--warning-500)' },
    danger: { bg: 'var(--danger-50)', fg: 'var(--danger-500)', dot: 'var(--danger-500)' },
    info: { bg: 'var(--accent-50)', fg: 'var(--accent-600)', dot: 'var(--accent-600)' },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.dot }} />}
      {children}
    </span>
  );
}

function KPI({ label, value, sub, accent = 'info', spark }) {
  const accentColor = {
    info: 'var(--accent-600)',
    success: 'var(--success-500)',
    warning: 'var(--warning-500)',
    danger: 'var(--danger-500)',
  }[accent];
  return (
    <div
      className="relative rounded-xl p-4 overflow-hidden"
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
    >
      <div className="kpi-accent" style={{ background: accentColor }} />
      <div
        className="text-[10px] font-semibold tracking-wider uppercase pl-2"
        style={{ color: 'var(--text-faint)' }}
      >
        {label}
      </div>
      <div className="pl-2 mt-2 flex items-baseline gap-2">
        <div
          className="text-[28px] font-semibold tabular-nums tracking-tight"
          style={{ color: 'var(--text-strong)' }}
        >
          {value}
        </div>
        {spark && (
          <span style={{ color: accentColor }} className="spark-bars">
            {spark.map((v, i) => (
              <span
                key={i}
                className={v > 0.7 ? 'hi' : ''}
                style={{ height: `${Math.max(4, v * 28)}px` }}
              />
            ))}
          </span>
        )}
      </div>
      {sub && (
        <div className="pl-2 mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle, actions, tabs }) {
  return (
    <div className="px-8 pt-6 pb-4" style={{ borderBottom: '1px solid var(--border-soft)' }}>
      <div className="flex items-start">
        <div className="min-w-0">
          <h1
            className="text-[20px] font-semibold tracking-tight"
            style={{ color: 'var(--text-strong)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      {tabs && <Tabs tabs={tabs} className="mt-4" />}
    </div>
  );
}

function Tabs({ tabs, className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.label}
          className="px-3 h-7 rounded-md text-[12px] font-medium"
          style={{
            background: t.active ? 'var(--accent-tint)' : 'transparent',
            color: t.active ? 'var(--accent-600)' : 'var(--text-muted)',
            fontWeight: t.active ? 600 : 500,
          }}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 tabular-nums opacity-70 font-mono text-[10px]">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function Seg({ options, active, onChange }) {
  return (
    <div
      className="inline-flex rounded-md p-0.5 gap-0.5"
      style={{ background: 'var(--surface-muted)' }}
    >
      {options.map((o) => (
        <button
          key={o.value || o}
          onClick={() => onChange && onChange(o.value || o)}
          className="px-2.5 h-6 rounded text-[11px] font-medium"
          style={{
            background: (o.value || o) === active ? 'var(--surface-card)' : 'transparent',
            color: (o.value || o) === active ? 'var(--text-strong)' : 'var(--text-muted)',
            boxShadow: (o.value || o) === active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          {o.label || o}
        </button>
      ))}
    </div>
  );
}

// expose
Object.assign(window, {
  I,
  Svg,
  Shell,
  Sidebar,
  Topbar,
  Breadcrumbs,
  IconBtn,
  Card,
  Btn,
  Badge,
  KPI,
  PageHeader,
  Tabs,
  Seg,
  SyncDot,
  UserChip,
});
