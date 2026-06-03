/* global React, Card, Btn, Badge, KPI, I, Seg, Sidebar */

// ─── MOBILE shell + screens ────────────────────────────────────────────────────

function MobileFrame({ children, dark = false, accent, label, density = 'cozy' }) {
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
        className="w-full h-full flex flex-col items-center justify-center gap-3 p-4"
        style={{ background: 'var(--surface-muted)' }}
      >
        {label && (
          <div
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--text-faint)' }}
          >
            {label}
          </div>
        )}
        <div className="mobile-frame" style={{ width: 390 + 24, height: 800 + 24 }}>
          <div
            className="screen relative"
            style={{
              width: 390,
              height: 800,
              background: 'var(--surface-page)',
              color: 'var(--text-strong)',
            }}
          >
            <MobileStatusBar />
            {children}
            <MobileTabBar />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileStatusBar() {
  return (
    <div
      className="h-11 flex items-center justify-between px-6 text-[13px] font-semibold"
      style={{ color: 'var(--text-strong)' }}
    >
      <span className="tabular-nums">07:42</span>
      <div className="flex items-center gap-1">
        <span className="w-4 h-3 rounded-sm" style={{ background: 'currentColor' }} />
        <span style={{ fontSize: 11 }}>5G</span>
        <span style={{ fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11 }}>92%</span>
      </div>
    </div>
  );
}

function MobileTabBar() {
  const tabs = [
    { id: 'hub', label: 'Hub', icon: 'Dashboard', active: true },
    { id: 'nc', label: 'NCs', icon: 'Triangle', badge: 7 },
    { id: 'corr', label: 'Corrida', icon: 'Plus' },
    { id: 'temp', label: 'Temp.', icon: 'Snow' },
    { id: 'me', label: 'Eu', icon: 'Users' },
  ];
  return (
    <nav
      className="absolute bottom-0 left-0 right-0 h-[72px] pt-2 pb-6 px-3 flex items-stretch"
      style={{ background: 'var(--surface-card)', borderTop: '1px solid var(--border-soft)' }}
    >
      {tabs.map((t) => {
        const Icon = I[t.icon];
        return (
          <a
            key={t.id}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            style={{ color: t.active ? 'var(--accent-600)' : 'var(--text-faint)' }}
          >
            <Icon size={20} strokeWidth={t.active ? 2.1 : 1.7} />
            <span className="text-[10px] font-medium">{t.label}</span>
            {t.badge && (
              <span
                className="absolute top-0.5 right-[24%] text-[9px] font-mono leading-none px-1 py-0.5 rounded-full"
                style={{ background: 'var(--danger-500)', color: '#fff' }}
              >
                {t.badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function MobileHubScreen({ dark = false, accent }) {
  return (
    <MobileFrame dark={dark} accent={accent} label="Mobile · Hub">
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="brand-mark"
            style={{ width: 32, height: 32, borderRadius: 9, fontSize: 13 }}
          >
            hc
          </span>
          <div className="leading-tight">
            <div className="text-[10.5px] font-mono" style={{ color: 'var(--text-faint)' }}>
              LABCLIN CENTRO
            </div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-strong)' }}>
              Bom dia, Renata
            </div>
          </div>
          <span
            className="ml-auto w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
          >
            <I.Bell size={16} />
          </span>
        </div>
      </div>

      <div className="px-4 space-y-3 overflow-auto" style={{ height: 800 - 44 - 72 - 56 }}>
        {/* Hero stat */}
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--accent-600), var(--accent-700))',
            color: '#fff',
          }}
        >
          <div className="text-[10px] font-semibold tracking-wider uppercase opacity-80">
            Taxa de aprovação · 28d
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-[40px] font-semibold tabular-nums tracking-tight leading-none">
              96.4%
            </div>
            <div className="text-[11px] opacity-80 font-mono">↑ 1.2</div>
          </div>
          <div className="mt-2 text-[11px] opacity-80">84 medidas · meta 95%</div>
          <div
            className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full opacity-20"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          />
        </div>

        {/* KPI mini-grid */}
        <div className="grid grid-cols-2 gap-2">
          <MobileKPI label="Corridas hoje" value="42" delta="↑ 8" tone="info" />
          <MobileKPI label="NCs abertas" value="7" delta="3 venc." tone="danger" />
          <MobileKPI label="CAPAs prazo" value="89%" delta="—" tone="warning" />
          <MobileKPI label="Temp · alertas" value="1" delta="T-04" tone="warning" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-faint)' }}
            >
              Pendentes hoje
            </div>
            <a className="text-[11px]" style={{ color: 'var(--accent-600)' }}>
              Ver tudo →
            </a>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
          >
            {[
              {
                tone: 'danger',
                title: 'Westgard 1-3s · CRE Nv2',
                meta: 'NC-2026-041 · há 12min',
                badge: 'crítico',
              },
              {
                tone: 'warning',
                title: 'Calibração Cobas vencida',
                meta: 'Bioquímica · D-2',
                badge: 'vence',
              },
              {
                tone: 'warning',
                title: 'Temp. T-04 excursão',
                meta: 'Pico 9.4 °C · 04:18',
                badge: '2h',
              },
              { tone: 'neutral', title: 'CAPA-202 revisar', meta: 'Vence em 3 dias', badge: 'rev' },
            ].map((it, i) => (
              <div
                key={i}
                className="px-3.5 py-3 flex items-start gap-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)' }}
              >
                <span
                  className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                  style={{
                    background:
                      it.tone === 'danger'
                        ? 'var(--danger-500)'
                        : it.tone === 'warning'
                          ? 'var(--warning-500)'
                          : 'var(--text-faint)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] font-medium leading-tight"
                    style={{ color: 'var(--text-strong)' }}
                  >
                    {it.title}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {it.meta}
                  </div>
                </div>
                <I.ChevR size={14} style={{ color: 'var(--text-faint)' }} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: 'var(--text-faint)' }}
          >
            Atalhos
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Nova corrida', icon: 'Plus', bg: 'var(--accent-600)', fg: '#fff' },
              { label: 'Registrar NC', icon: 'Triangle' },
              { label: 'Liberar', icon: 'Check' },
              { label: 'Temperatura', icon: 'Snow' },
            ].map((s, i) => {
              const Icon = I[s.icon];
              return (
                <button
                  key={i}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl"
                  style={{
                    background: s.bg || 'var(--surface-card)',
                    color: s.fg || 'var(--text-body)',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <Icon size={16} />
                  <span className="text-[10px] font-medium text-center">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}

function MobileKPI({ label, value, delta, tone }) {
  const accentColor = {
    info: 'var(--accent-600)',
    success: 'var(--success-500)',
    warning: 'var(--warning-500)',
    danger: 'var(--danger-500)',
  }[tone];
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-faint)' }}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="text-[22px] font-semibold tabular-nums tracking-tight"
          style={{ color: 'var(--text-strong)' }}
        >
          {value}
        </span>
        <span className="text-[10px] font-mono" style={{ color: accentColor }}>
          {delta}
        </span>
      </div>
    </div>
  );
}

function MobileNCDetailScreen({ dark = false, accent }) {
  return (
    <MobileFrame dark={dark} accent={accent} label="Mobile · NC detalhe">
      <div className="px-4 pt-1 pb-3 flex items-center gap-2.5">
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
        >
          <I.ChevL size={16} />
        </button>
        <div className="leading-tight">
          <div className="text-[10.5px] font-mono" style={{ color: 'var(--text-faint)' }}>
            NC · Não conformidade
          </div>
          <div
            className="text-[12px] font-mono font-semibold"
            style={{ color: 'var(--text-strong)' }}
          >
            NC-2026-041
          </div>
        </div>
        <button
          className="ml-auto w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
        >
          <I.More size={16} />
        </button>
      </div>

      <div className="px-4 overflow-auto space-y-3" style={{ height: 800 - 44 - 72 - 56 }}>
        <h1
          className="text-[18px] font-semibold tracking-tight leading-snug"
          style={{ color: 'var(--text-strong)' }}
        >
          Westgard 1-3s recorrente · Creatinina Nv2
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="danger">Crítica</Badge>
          <Badge tone="warning" dot={false}>
            Sem CAPA
          </Badge>
          <Badge tone="neutral" dot={false}>
            Bioquímica
          </Badge>
        </div>

        <div
          className="rounded-xl p-3.5"
          style={{ background: 'var(--danger-50)', border: '1px solid var(--danger-500)' }}
        >
          <div
            className="flex items-center gap-2 text-[12.5px] font-semibold"
            style={{ color: 'var(--danger-500)' }}
          >
            <I.Triangle size={14} /> Ação obrigatória em 2 dias
          </div>
          <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--text-body)' }}>
            Atribuir CAPA com causa raiz e plano corretivo.
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Btn kind="primary" size="sm" className="w-full justify-center">
              Criar CAPA
            </Btn>
            <Btn kind="secondary" size="sm" className="w-full justify-center">
              Vincular
            </Btn>
          </div>
        </div>

        <div
          className="rounded-xl divide-y"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
        >
          {[
            ['Aberta por', 'Sistema (CQI)'],
            ['Data', '08 mai 2026 · 06:50'],
            ['Responsável', 'Ana Pereira'],
            ['Vencimento', '11 mai · -2d', 'danger'],
            ['Recorrência', '3 em 30d'],
          ].map(([k, v, tone], i) => (
            <div
              key={i}
              className="px-3.5 py-2.5 flex items-center justify-between text-[12px]"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span
                className="font-medium"
                style={{ color: tone === 'danger' ? 'var(--danger-500)' : 'var(--text-strong)' }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>

        <div
          className="rounded-xl p-3.5"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-faint)' }}
          >
            Descrição
          </div>
          <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Terceira ocorrência consecutiva de Westgard 1-3s em CRE nível 2 no lote BQ-1812. Última
            corrida 14.50 com z +3.14. Padrão de drift positivo sugere problema sistêmico.
          </p>
        </div>

        <div
          className="rounded-xl p-3.5"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-faint)' }}
          >
            Cronologia
          </div>
          <ol className="space-y-2.5">
            {[
              ['1-3s · 14.50 · z +3.14', '13 mai 06:50', 'danger'],
              ['1-2s · 14.21 · z +2.11', '11 mai 07:02', 'warning'],
              ['1-3s · 14.50 · z +3.14', '08 mai 06:49', 'danger'],
              ['NC aberta automaticamente', '08 mai 06:51', 'neutral'],
            ].map(([t, w, tone], i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background:
                      tone === 'danger'
                        ? 'var(--danger-500)'
                        : tone === 'warning'
                          ? 'var(--warning-500)'
                          : 'var(--text-faint)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px]" style={{ color: 'var(--text-strong)' }}>
                    {t}
                  </div>
                  <div
                    className="text-[10.5px] mt-0.5 font-mono"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {w}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </MobileFrame>
  );
}

// ─── TABLET (collapsed sidebar) ────────────────────────────────────────────────

function TabletFrame({ children, dark = false, accent, label, density = 'cozy' }) {
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
        className="w-full h-full flex flex-col items-center justify-center gap-3 p-4"
        style={{ background: 'var(--surface-muted)' }}
      >
        {label && (
          <div
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--text-faint)' }}
          >
            {label}
          </div>
        )}
        <div className="tablet-frame" style={{ width: 1024 + 20, height: 768 + 20 }}>
          <div
            className="screen"
            style={{
              width: 1024,
              height: 768,
              background: 'var(--surface-page)',
              color: 'var(--text-strong)',
            }}
          >
            <div className="flex h-full">
              <Sidebar collapsed />
              <div className="flex-1 min-w-0 flex flex-col">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletAnalyzerScreen({ dark = false, accent }) {
  return (
    <TabletFrame dark={dark} accent={accent} label="Tablet 1024 · CQI">
      <header
        className="shrink-0 h-12 flex items-center px-5 gap-3"
        style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-soft)' }}
      >
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-strong)' }}>
          HGB · Lote HC-2904
        </span>
        <span className="text-[10.5px] font-mono" style={{ color: 'var(--text-faint)' }}>
          · Sysmex XN-1000 · 28d · N=84
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Seg
            options={[
              { value: 'n1', label: 'Nv 1' },
              { value: 'n2', label: 'Nv 2' },
            ]}
            active="n1"
          />
          <Btn kind="primary" size="sm" icon={<I.Plus size={12} />}>
            Nova medida
          </Btn>
        </div>
      </header>
      <div className="flex-1 p-4 grid grid-cols-[1fr_240px] gap-3 overflow-auto">
        <Card padded={false}>
          <div
            className="px-4 py-2.5 flex items-center"
            style={{ borderBottom: '1px solid var(--border-hairline)' }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-faint)' }}
            >
              Levey-Jennings · Nv 1
            </div>
            <div className="ml-auto flex items-center gap-3 font-mono text-[11.5px]">
              <span style={{ color: 'var(--text-body)' }}>
                X̄ <strong style={{ color: 'var(--text-strong)' }}>13.62</strong>
              </span>
              <span style={{ color: 'var(--text-faint)' }}>SD 0.28</span>
              <span style={{ color: 'var(--text-faint)' }}>CV 2.05%</span>
            </div>
          </div>
          <div className="px-2 py-1">
            <MiniLJChart />
          </div>
        </Card>
        <aside className="space-y-3">
          <Card title="Estado do lote">
            <dl className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between">
                <dt style={{ color: 'var(--text-muted)' }}>Validade</dt>
                <dd className="font-mono" style={{ color: 'var(--text-strong)' }}>
                  15 jun
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--text-muted)' }}>Aberto</dt>
                <dd className="font-mono" style={{ color: 'var(--text-strong)' }}>
                  02 abr
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--text-muted)' }}>Consumo</dt>
                <dd className="font-mono" style={{ color: 'var(--text-strong)' }}>
                  68 / 240
                </dd>
              </div>
            </dl>
          </Card>
          <Card title="Última corrida">
            <div
              className="font-mono text-[18px] tabular-nums"
              style={{ color: 'var(--text-strong)' }}
            >
              13.84
            </div>
            <div className="text-[10.5px] font-mono mt-1" style={{ color: 'var(--text-faint)' }}>
              z +0.79 · 13 mai 06:48
            </div>
            <div className="mt-2">
              <Badge tone="success">Aprovada</Badge>
            </div>
          </Card>
        </aside>
      </div>
    </TabletFrame>
  );
}

function MiniLJChart() {
  const W = 720,
    H = 260,
    padL = 44,
    padR = 10,
    padT = 10,
    padB = 24;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const pts = Array.from({ length: 28 }, (_, i) => {
    let z = (Math.sin(i * 0.6) + (Math.random() - 0.5) * 0.7) * (Math.random() > 0.9 ? 2 : 1);
    return { x: i, z };
  });
  pts[19] = { x: 19, z: 3.14 };
  pts[16] = { x: 16, z: 2.11 };
  const yToPx = (z) => padT + (1 - (z + 3.5) / 7) * innerH;
  const xToPx = (i) => padL + (i / 27) * innerW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]">
      <rect
        x={padL}
        y={yToPx(1)}
        width={innerW}
        height={yToPx(-1) - yToPx(1)}
        fill="var(--success-50)"
      />
      <rect
        x={padL}
        y={yToPx(3)}
        width={innerW}
        height={yToPx(2) - yToPx(3)}
        fill="var(--warning-50)"
      />
      <rect
        x={padL}
        y={yToPx(-2)}
        width={innerW}
        height={yToPx(-3) - yToPx(-2)}
        fill="var(--warning-50)"
      />
      <rect
        x={padL}
        y={yToPx(3.5)}
        width={innerW}
        height={yToPx(3) - yToPx(3.5)}
        fill="var(--danger-50)"
      />
      <rect
        x={padL}
        y={yToPx(-3)}
        width={innerW}
        height={yToPx(-3.5) - yToPx(-3)}
        fill="var(--danger-50)"
      />
      {[-3, -2, -1, 0, 1, 2, 3].map((z) => (
        <g key={z}>
          <line
            x1={padL}
            y1={yToPx(z)}
            x2={W - padR}
            y2={yToPx(z)}
            stroke={z === 0 ? 'var(--text-faint)' : 'var(--border-soft)'}
            strokeDasharray={z === 0 ? '' : '2 4'}
          />
          <text
            x={padL - 6}
            y={yToPx(z) + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fill="var(--text-faint)"
          >
            {z === 0 ? 'X̄' : `${z > 0 ? '+' : ''}${z}s`}
          </text>
        </g>
      ))}
      {[1, 7, 14, 21, 28].map((d) => (
        <text
          key={d}
          x={xToPx(d - 1)}
          y={H - 8}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fill="var(--text-faint)"
        >
          {d}d
        </text>
      ))}
      <polyline
        fill="none"
        stroke="var(--accent-600)"
        strokeWidth="1.4"
        points={pts.map((p, i) => `${xToPx(i)},${yToPx(p.z)}`).join(' ')}
      />
      {pts.map((p, i) => {
        const fill =
          Math.abs(p.z) > 3
            ? 'var(--danger-500)'
            : Math.abs(p.z) > 2
              ? 'var(--warning-500)'
              : 'var(--accent-600)';
        return (
          <circle
            key={i}
            cx={xToPx(i)}
            cy={yToPx(p.z)}
            r={Math.abs(p.z) > 2 ? 3 : 2.4}
            fill={fill}
            stroke="var(--surface-card)"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

Object.assign(window, {
  MobileFrame,
  MobileHubScreen,
  MobileNCDetailScreen,
  TabletFrame,
  TabletAnalyzerScreen,
});
