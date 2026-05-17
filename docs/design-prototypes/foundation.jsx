/* global React, Card, Btn, Badge, KPI, I, Seg, Tabs */

// ─── FOUNDATION (Type, Color, Components) ─────────────────────────────────────

function FoundationCard({ dark = false, accent }) {
  const accentStyle = accent ? {
    '--accent-600': accent.c600, '--accent-700': accent.c700, '--accent-500': accent.c500,
    '--accent-50':  accent.c50,  '--accent-tint': accent.tint,
  } : {};
  return (
    <div className={`${dark?'dark':''}`} style={accentStyle}>
      <div className="h-full w-full p-10"
           style={{background:'var(--surface-page)', color:'var(--text-strong)'}}>
        <div className="flex items-start gap-3">
          <span className="brand-mark">hc</span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{color:'var(--text-faint)'}}>Design System</div>
            <h1 className="text-[28px] font-semibold tracking-tight">hc-quality / cqi · v1.4</h1>
            <p className="mt-2 text-[13px] max-w-prose" style={{color:'var(--text-muted)'}}>
              Linguagem visual unificada para os {">"}50 módulos do sistema. Light + dark mode nativos,
              tokens semânticos, tipografia técnica. Inspirado em Linear, Stripe e Vercel — sensibilidade clínica.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6">
          {/* Type scale */}
          <section>
            <Heading kicker="A" title="Tipografia"/>
            <div className="space-y-3 mt-4">
              <TypeRow label="h1 · página"     size="20px" weight="600" tracking="-0.02em">Visão geral · Labclin</TypeRow>
              <TypeRow label="h2 · seção"     size="14px" weight="600">Operação em andamento</TypeRow>
              <TypeRow label="body"            size="13px" weight="400">Terça-feira, 13 de maio de 2026</TypeRow>
              <TypeRow label="label"           size="10px" weight="600" upper tracking="0.06em">Westgard ativos</TypeRow>
              <TypeRow label="mono · numérico" size="13px" weight="500" mono>13.62 g/dL · z +0.79</TypeRow>
            </div>
            <div className="mt-4 text-[10.5px]" style={{color:'var(--text-faint)'}}>
              <span className="font-mono">Inter · JetBrains Mono</span> — substituíveis pelo painel de Tweaks.
            </div>
          </section>

          {/* Colors */}
          <section>
            <Heading kicker="B" title="Cores semânticas"/>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Swatch label="Accent" tokens={['accent-50','accent-500','accent-600','accent-700']}/>
              <Swatch label="Success" tokens={['success-50','success-500']}/>
              <Swatch label="Warning" tokens={['warning-50','warning-500']}/>
              <Swatch label="Danger" tokens={['danger-50','danger-500']}/>
            </div>
            <div className="mt-3 text-[10.5px]" style={{color:'var(--text-faint)'}}>
              Status sempre semânticos. Cores neutras vêm de slate.
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1">
              {[
                ['#FFFFFF','#F8FAFC','#F1F5F9','#E2E8F0','#94A3B8'],
                ['#64748B','#334155','#1E293B','#0F172A','#0B0F14'],
              ].flat().map((c,i)=>(
                <div key={i} className="aspect-square rounded" style={{background:c, border:'1px solid var(--border-soft)'}}/>
              ))}
            </div>
          </section>

          {/* Spacing & shape */}
          <section>
            <Heading kicker="C" title="Forma & espaço"/>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{color:'var(--text-faint)'}}>Raio</div>
                <div className="flex items-end gap-2">
                  {[4,6,8,12,16].map(r=>(
                    <div key={r} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10" style={{background:'var(--accent-tint)', borderRadius:`${r}px`, border:'1px solid var(--accent-600)'}}/>
                      <span className="text-[10px] font-mono" style={{color:'var(--text-faint)'}}>{r}px</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{color:'var(--text-faint)'}}>Densidade</div>
                <div className="flex gap-2">
                  {[['compact','8'],['cozy','12'],['comfortable','16']].map(([k,h])=>(
                    <div key={k} className="flex-1 rounded-md p-2.5" style={{background:'var(--surface-card)', border:'1px solid var(--border-soft)'}}>
                      <div className="text-[10px] font-mono uppercase tracking-wider" style={{color:'var(--text-faint)'}}>{k}</div>
                      <div className="mt-1.5 space-y-1">
                        {Array.from({length:3}).map((_,i)=>(
                          <div key={i} style={{height:`${h}px`, background:'var(--surface-muted)', borderRadius:'2px'}}/>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-10">
          <Heading kicker="D" title="Componentes-chave" />
          <div className="mt-4 grid grid-cols-4 gap-4">
            {/* Buttons */}
            <Card title="Botões" padded>
              <div className="space-y-2">
                <Btn kind="primary" size="md" icon={<I.Plus size={13}/>} className="w-full justify-center">Primário</Btn>
                <Btn kind="secondary" size="md" className="w-full justify-center">Secundário</Btn>
                <Btn kind="ghost" size="md" className="w-full justify-center">Ghost</Btn>
                <Btn kind="danger" size="md" className="w-full justify-center">Destrutivo</Btn>
              </div>
            </Card>

            {/* Badges */}
            <Card title="Status semântico">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="success">Aprovada</Badge>
                <Badge tone="warning">Aviso 1-2s</Badge>
                <Badge tone="danger">Rejeitada 1-3s</Badge>
                <Badge tone="info">Em análise</Badge>
                <Badge tone="neutral">Encerrada</Badge>
                <Badge tone="warning" dot={false}>Vencida</Badge>
                <Badge tone="info" dot={false}>CAPA-199</Badge>
                <Badge tone="danger" dot={false}>Crítica</Badge>
              </div>
            </Card>

            {/* Westgard */}
            <Card title="Regras Westgard">
              <div className="grid grid-cols-3 gap-1.5">
                <span className="wg" style={{background:'var(--warning-50)', color:'var(--warning-500)', borderColor:'var(--warning-500)'}}>1-2s</span>
                <span className="wg" style={{background:'var(--danger-50)',  color:'var(--danger-500)',  borderColor:'var(--danger-500)'}}>1-3s</span>
                <span className="wg" style={{background:'var(--danger-50)',  color:'var(--danger-500)',  borderColor:'var(--danger-500)'}}>2-2s</span>
                <span className="wg" style={{background:'transparent', color:'var(--text-faint)', borderColor:'var(--border-soft)'}}>R-4s</span>
                <span className="wg" style={{background:'transparent', color:'var(--text-faint)', borderColor:'var(--border-soft)'}}>4-1s</span>
                <span className="wg" style={{background:'transparent', color:'var(--text-faint)', borderColor:'var(--border-soft)'}}>10x</span>
              </div>
              <div className="mt-3 text-[10.5px]" style={{color:'var(--text-faint)'}}>
                Apenas <span className="font-mono">1-2s</span> é aviso; o restante rejeita corrida.
              </div>
            </Card>

            {/* KPI */}
            <div className="grid grid-rows-2 gap-2">
              <KPI label="Taxa aprovação" value="96.4%" sub="↑ 1.2 vs sem. passada" accent="success" />
              <KPI label="NCs abertas" value="7" sub="3 vencidas" accent="danger" />
            </div>

            {/* Form atoms */}
            <Card title="Formulário" className="col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10.5px] font-semibold mb-1.5" style={{color:'var(--text-strong)'}}>Lote *</label>
                  <select className="w-full px-2.5 h-9 rounded-md text-[12.5px]" style={{background:'var(--surface-muted)', color:'var(--text-body)'}}>
                    <option>HC-2904 · HGB Sysmex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold mb-1.5" style={{color:'var(--text-strong)'}}>Valor</label>
                  <input defaultValue="13.62" className="w-full px-2.5 h-9 rounded-md font-mono text-[13px]" style={{background:'var(--surface-muted)', color:'var(--text-strong)'}}/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10.5px] font-semibold mb-1.5" style={{color:'var(--text-strong)'}}>Observação</label>
                  <textarea rows={2} className="w-full p-2 rounded-md text-[12.5px]" style={{background:'var(--surface-muted)', color:'var(--text-body)'}}/>
                </div>
              </div>
            </Card>

            {/* Filters */}
            <Card title="Filtros & segmented">
              <div className="space-y-2.5">
                <Seg options={[{value:'a',label:'Hoje'},{value:'b',label:'7d'},{value:'c',label:'30d'}]} active="a"/>
                <Tabs tabs={[{label:'Abertas',count:7,active:true},{label:'Em análise',count:12}]}/>
              </div>
            </Card>

            {/* Empty state */}
            <Card title="Empty state" className="col-span-2">
              <div className="p-6 dot-grid rounded-md flex flex-col items-center text-center"
                   style={{ minHeight: 140, background:'var(--surface-muted)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background:'var(--accent-tint)', color:'var(--accent-600)' }}>
                  <I.Beaker size={18}/>
                </div>
                <div className="mt-2 text-[13px] font-semibold" style={{color:'var(--text-strong)'}}>Nenhum lote ativo</div>
                <div className="mt-1 text-[11.5px]" style={{color:'var(--text-muted)'}}>Importe uma bula ou cadastre manualmente para começar.</div>
                <Btn kind="primary" size="sm" className="mt-3" icon={<I.Plus size={12}/>}>Novo lote</Btn>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Heading({ kicker, title }) {
  return (
    <div className="flex items-baseline gap-2 border-b pb-2" style={{borderColor:'var(--border-soft)'}}>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{background:'var(--accent-tint)', color:'var(--accent-600)'}}>{kicker}</span>
      <h2 className="text-[13px] font-semibold tracking-tight" style={{color:'var(--text-strong)'}}>{title}</h2>
    </div>
  );
}

function TypeRow({ label, size, weight, tracking, upper, mono, children }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] font-mono w-28 shrink-0" style={{color:'var(--text-faint)'}}>{label}</span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontSize: size, fontWeight: weight, letterSpacing: tracking,
        textTransform: upper ? 'uppercase' : 'none',
        color: 'var(--text-strong)',
      }}>{children}</span>
    </div>
  );
}

function Swatch({ label, tokens }) {
  return (
    <div>
      <div className="text-[10px] font-mono mb-1" style={{color:'var(--text-faint)'}}>{label}</div>
      <div className="rounded-md overflow-hidden flex" style={{border:'1px solid var(--border-soft)'}}>
        {tokens.map(t => <div key={t} className="flex-1 h-9" style={{background:`var(--${t})`}}/>)}
      </div>
    </div>
  );
}

Object.assign(window, { FoundationCard });
