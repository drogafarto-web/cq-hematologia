/* global React, Card, KPI, Btn, Badge, PageHeader, Tabs, Seg, I, Shell, WgChip */
const { useState: useStateQ } = React;

// ─── NÃO CONFORMIDADES ────────────────────────────────────────────────────────

function NCScreen() {
  return (
    <Shell page="nc">
      <PageHeader title="Não conformidades"
        subtitle="7 abertas · 3 vencidas · 2 críticas sem CAPA"
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Exportar</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Registrar NC</Btn></>}
        tabs={[
          { label:'Abertas',   count: 7,  active:true },
          { label:'Em análise',count: 12 },
          { label:'CAPA ativa',count: 22 },
          { label:'Encerradas',count: 184 },
          { label:'Todas',     count: 225 },
        ]}/>

      <div className="px-8 py-4 flex items-center gap-2" style={{borderBottom:'1px solid var(--border-soft)'}}>
        <Seg options={[{value:'all',label:'Todas'},{value:'crit',label:'Críticas'},{value:'maior',label:'Maior'},{value:'menor',label:'Menor'}]} active="all"/>
        <Seg options={[{value:'tdos',label:'Todos setores'},{value:'hema',label:'Hema'},{value:'bioq',label:'Bioq'},{value:'coag',label:'Coag'},{value:'imuno',label:'Imuno'}]} active="tdos"/>
        <Seg options={[{value:'7d',label:'7d'},{value:'30d',label:'30d'},{value:'90d',label:'90d'}]} active="30d"/>
        <div className="ml-auto flex items-center gap-2 text-[11px]" style={{color:'var(--text-muted)'}}>
          <input placeholder="Filtrar por título, ID, lote…" className="w-72 px-3 h-8 rounded-md text-[12px]"
                 style={{background:'var(--surface-muted)', color:'var(--text-body)'}}/>
          <Btn kind="ghost" size="md" icon={<I.Filter size={13}/>}>Mais filtros</Btn>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_440px] h-[calc(100%-180px)]">
        <div className="overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10" style={{background:'var(--surface-card)'}}>
              <tr style={{ color:'var(--text-faint)', borderBottom:'1px solid var(--border-soft)' }}>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3 pl-8 w-[88px]">ID</th>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Título</th>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Setor</th>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Severidade</th>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">CAPA</th>
                <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Responsável</th>
                <th className="text-right text-[10px] uppercase tracking-wider font-semibold py-3 pr-4">Vence em</th>
              </tr>
            </thead>
            <tbody>
              {NC_ROWS.map((r,i)=>(
                <tr key={r.id} className="cursor-pointer transition-colors"
                    style={{ borderBottom:'1px solid var(--border-hairline)', background: i===0?'var(--accent-tint)':'transparent' }}>
                  <td className="py-3 pl-8 font-mono text-[11.5px]" style={{color: i===0?'var(--accent-600)':'var(--text-muted)'}}>{r.id}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium" style={{color:'var(--text-strong)'}}>{r.title}</div>
                    <div className="text-[11px] mt-0.5" style={{color:'var(--text-faint)'}}>{r.source}</div>
                  </td>
                  <td className="py-3"><span className="text-[11.5px]" style={{color:'var(--text-body)'}}>{r.sector}</span></td>
                  <td className="py-3"><Badge tone={r.sev==='Crítica'?'danger':r.sev==='Maior'?'warning':'neutral'}>{r.sev}</Badge></td>
                  <td className="py-3">{r.capa ? <Badge tone="info" dot={false}>{r.capa}</Badge> : <span className="text-[11px]" style={{color:'var(--text-faint)'}}>Não atribuída</span>}</td>
                  <td className="py-3 text-[11.5px]" style={{color:'var(--text-body)'}}>{r.owner}</td>
                  <td className="py-3 pr-4 text-right font-mono text-[11.5px]" style={{color: r.overdue?'var(--danger-500)':'var(--text-body)'}}>{r.overdue?`-${r.due}d`:`${r.due}d`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-8 py-3 flex items-center text-[11px]" style={{ borderTop:'1px solid var(--border-soft)', color:'var(--text-muted)' }}>
            <span>1–8 de 225</span>
            <div className="ml-auto flex items-center gap-1">
              <Btn kind="ghost" size="sm" icon={<I.ChevL size={12}/>}>Anterior</Btn>
              <Btn kind="ghost" size="sm">Próximo<I.ChevR size={12}/></Btn>
            </div>
          </div>
        </div>

        {/* Detail drawer in same view */}
        <NCDetailDrawer />
      </div>
    </Shell>
  );
}

const NC_ROWS = [
  { id:'NC-2026-041', title:'Westgard 1-3s recorrente · Creatinina Nv2', source:'CQI · Bioquímica · BQ-1812', sector:'Bioquímica', sev:'Crítica', capa:null,       owner:'Ana Pereira',    due:2, overdue:true },
  { id:'NC-2026-040', title:'Temperatura geladeira > 8°C (pico 9.4°C)',  source:'Sensor T-04 · Geladeira reagentes',  sector:'Geral',     sev:'Maior',   capa:'CAPA-202', owner:'Renata C.',      due:4 },
  { id:'NC-2026-039', title:'Calibração Cobas c311 vencida',             source:'Equipamento · Bioquímica',            sector:'Bioquímica', sev:'Maior',   capa:null,        owner:'Carlos M.',       due:1, overdue:true },
  { id:'NC-2026-038', title:'Aviso 1-2s recorrente · HGB Nv2',           source:'CQI · Hematologia · HC-2904',         sector:'Hematologia',sev:'Menor',   capa:'CAPA-199', owner:'Renata C.',      due:8 },
  { id:'NC-2026-037', title:'Operador não treinado executou TP',         source:'Auditoria interna · Coag',            sector:'Coagulação', sev:'Maior',   capa:'CAPA-198', owner:'Carlos M.',       due:6 },
  { id:'NC-2026-036', title:'Bula desatualizada · CRE',                  source:'Bioquímica · BQ-1812',                sector:'Bioquímica', sev:'Menor',   capa:null,        owner:'Ana Pereira',    due:0, overdue:true },
  { id:'NC-2026-035', title:'Reclamação cliente · atraso liberação',     source:'Cliente externo',                     sector:'Pré/Pós',   sev:'Menor',   capa:'CAPA-197', owner:'Suzana L.',       due:11 },
  { id:'NC-2026-034', title:'Falha autoclave · ciclo abortado',          source:'Biossegurança',                       sector:'Geral',     sev:'Maior',   capa:'CAPA-196', owner:'Carlos M.',       due:9 },
];

function NCDetailDrawer() {
  return (
    <aside className="overflow-y-auto" style={{ borderLeft:'1px solid var(--border-soft)', background:'var(--surface-card)'}}>
      <div className="px-5 py-4 flex items-center" style={{borderBottom:'1px solid var(--border-soft)'}}>
        <div>
          <div className="text-[11px] font-mono" style={{color:'var(--text-faint)'}}>NC-2026-041 · aberta há 5d</div>
          <h3 className="mt-1 text-[14px] font-semibold tracking-tight" style={{color:'var(--text-strong)'}}>Westgard 1-3s recorrente · Creatinina Nv2</h3>
        </div>
        <Btn kind="ghost" size="sm" icon={<I.X size={13}/>} className="ml-auto"/>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="danger">Crítica</Badge>
          <Badge tone="warning" dot={false}>Sem CAPA</Badge>
          <Badge tone="neutral" dot={false}>Bioquímica</Badge>
          <Badge tone="neutral" dot={false}>BQ-1812</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <Meta label="Aberta por"  value="Sistema (CQI)"/>
          <Meta label="Data"         value="08 mai 2026 · 06:50" mono/>
          <Meta label="Responsável"  value="Ana Pereira"/>
          <Meta label="Vencimento"   value="11 mai · -2d" tone="danger" mono/>
          <Meta label="Severidade"   value="Crítica"/>
          <Meta label="Recorrência"  value="3 em 30d" mono/>
        </div>

        <Section title="Descrição">
          <p className="text-[12.5px] leading-relaxed" style={{color:'var(--text-body)'}}>
            Terceira ocorrência consecutiva de Westgard 1-3s em Creatinina nível 2 no lote BQ-1812.
            Última corrida: 14.50 com z-score +3.14. Padrão de drift positivo sugere problema sistêmico
            no calibrador ou reagente. Bloqueio automático de liberação ativo.
          </p>
        </Section>

        <Section title="Cronologia">
          <ol className="space-y-3">
            {TIMELINE.map((t,i)=>(
              <li key={i} className="flex gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                     style={{background: t.tone==='danger'?'var(--danger-50)':t.tone==='success'?'var(--success-50)':'var(--surface-muted)',
                              color: t.tone==='danger'?'var(--danger-500)':t.tone==='success'?'var(--success-500)':'var(--text-muted)'}}>
                  <I.Pulse size={12}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px]" style={{color:'var(--text-strong)'}}>{t.title}</div>
                  <div className="text-[10.5px] mt-0.5 font-mono" style={{color:'var(--text-faint)'}}>{t.when} · {t.by}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Próxima ação obrigatória" tone="danger">
          <div className="text-[12.5px] mb-2" style={{color:'var(--text-body)'}}>Atribuir CAPA com causa raiz e plano corretivo nos próximos <strong>2 dias</strong>.</div>
          <div className="flex gap-2">
            <Btn kind="primary" size="md" icon={<I.Plus size={13}/>}>Criar CAPA</Btn>
            <Btn kind="secondary" size="md">Vincular existente</Btn>
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Meta({ label, value, mono, tone }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{color:'var(--text-faint)'}}>{label}</div>
      <div className={`mt-1 ${mono?'font-mono':''}`}
           style={{color: tone==='danger'?'var(--danger-500)':'var(--text-strong)', fontWeight: 500}}>{value}</div>
    </div>
  );
}

function Section({ title, children, tone }) {
  return (
    <div className="rounded-lg p-3"
         style={{
           background: tone==='danger'?'var(--danger-50)':'var(--surface-muted)',
           border: tone==='danger'?'1px solid var(--danger-500)':'1px solid var(--border-hairline)',
         }}>
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-2"
           style={{color: tone==='danger'?'var(--danger-500)':'var(--text-faint)'}}>{title}</div>
      {children}
    </div>
  );
}

const TIMELINE = [
  { tone:'danger',  title:'Westgard 1-3s · 14.50 g/dL · z +3.14', when:'13 mai 06:50', by:'sistema · CQI' },
  { tone:'warn',    title:'Westgard 1-2s · 14.21 g/dL · z +2.11', when:'11 mai 07:02', by:'sistema · CQI' },
  { tone:'danger',  title:'Westgard 1-3s · 14.50 g/dL · z +3.14', when:'08 mai 06:49', by:'sistema · CQI' },
  { tone:'neutral', title:'NC aberta automaticamente',           when:'08 mai 06:51', by:'sistema'        },
  { tone:'neutral', title:'Atribuída a Ana Pereira',             when:'08 mai 10:14', by:'Renata C.'      },
];

// ─── AUDITORIA TRAIL ──────────────────────────────────────────────────────────

function AuditoriaScreen() {
  return (
    <Shell page="auditoria">
      <PageHeader title="Audit trail · imutável"
        subtitle={<>Cadeia HMAC · hash root <span className="font-mono">b91f…73a2</span> · 2.4M eventos · íntegro</>}
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Exportar JSONL</Btn>
                   <Btn kind="secondary" size="md" icon={<I.Shield size={13}/>}>Verificar cadeia</Btn></>}
        tabs={[
          { label:'Todos', active:true, count:'2.4M' },
          { label:'Usuários' },
          { label:'CQI' },
          { label:'NCs / CAPAs' },
          { label:'Configuração' },
          { label:'Acessos negados' },
        ]}/>

      <div className="px-8 py-4 flex items-center gap-2" style={{borderBottom:'1px solid var(--border-soft)'}}>
        <Seg options={[{value:'1h',label:'1h'},{value:'24h',label:'24h'},{value:'7d',label:'7d'},{value:'30d',label:'30d'},{value:'90d',label:'90d'}]} active="24h"/>
        <Seg options={[{value:'all',label:'Todas ações'},{value:'wr',label:'Escrita'},{value:'rd',label:'Leitura'},{value:'auth',label:'Auth'}]} active="all"/>
        <input placeholder="actor · target · action · payload contains…" className="ml-auto w-[420px] px-3 h-8 rounded-md text-[12px] font-mono"
               style={{background:'var(--surface-muted)', color:'var(--text-body)'}}/>
      </div>

      <div className="px-8 py-5 overflow-auto h-[calc(100%-180px)]">
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-3 flex items-center gap-2" style={{color:'var(--text-faint)'}}>
          <span>13 mai 2026 — terça</span>
          <span className="flex-1 h-px" style={{background:'var(--border-soft)'}}/>
          <span className="font-mono">214 eventos</span>
        </div>

        <ol className="space-y-2">
          {AUDIT.map((a,i)=>(
            <li key={i} className="flex items-start gap-3 rounded-md px-3 py-2.5"
                style={{ background:'var(--surface-card)', border:'1px solid var(--border-hairline)' }}>
              <div className="font-mono text-[11px] tabular-nums w-[64px] shrink-0" style={{color:'var(--text-faint)'}}>{a.time}</div>
              <div className="shrink-0">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: a.kind==='auth'?'var(--accent-50)':a.kind==='delete'?'var(--danger-50)':a.kind==='write'?'var(--warning-50)':'var(--surface-muted)',
                        color: a.kind==='auth'?'var(--accent-600)':a.kind==='delete'?'var(--danger-500)':a.kind==='write'?'var(--warning-500)':'var(--text-muted)',
                      }}>{a.kind}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px]" style={{color:'var(--text-strong)'}}>
                  <span className="font-medium">{a.actor}</span>
                  <span style={{color:'var(--text-muted)'}}> {a.verb} </span>
                  <span className="font-mono text-[11.5px]" style={{color:'var(--accent-600)'}}>{a.target}</span>
                </div>
                {a.detail && <div className="text-[11px] mt-1 font-mono" style={{color:'var(--text-faint)'}}>{a.detail}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-mono" style={{color:'var(--text-faint)'}}>{a.ip}</div>
                <div className="text-[10px] font-mono mt-0.5" style={{color:'var(--text-faint)'}}>seq #{a.seq}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Shell>
  );
}

const AUDIT = [
  { time:'07:38:21', kind:'write',  actor:'Renata Coutinho',  verb:'aprovou corrida',                            target:'runs/abc1f3', detail:'HGB · HC-2904 · z +0.79',                         ip:'10.0.4.12', seq:'2418991' },
  { time:'07:31:08', kind:'write',  actor:'Carlos Marques',   verb:'iniciou corrida',                            target:'runs/9d2e44', detail:'TP · CG-0457 · operador validado',                  ip:'10.0.4.18', seq:'2418988' },
  { time:'07:24:55', kind:'auth',   actor:'Ana Pereira',      verb:'autenticou via SSO',                         target:'/auth',       detail:'MFA ok · device fingerprint 8f31…',                ip:'10.0.4.21', seq:'2418984' },
  { time:'07:15:42', kind:'delete', actor:'Renata Coutinho',  verb:'rejeitou corrida (Westgard 1-3s)',           target:'runs/ce40a2', detail:'CRE · BQ-1812 · z +3.14 · bloqueio acionado',     ip:'10.0.4.12', seq:'2418972' },
  { time:'07:14:09', kind:'write',  actor:'sistema',          verb:'abriu NC automaticamente',                   target:'ncs/041',     detail:'origem: Westgard 1-3s · severidade Crítica',       ip:'—',         seq:'2418968' },
  { time:'06:58:31', kind:'read',   actor:'Suzana L. (médico)', verb:'consultou resultado liberado',             target:'reports/r-9931',detail:'paciente 51********95 · acesso autorizado',       ip:'200.187.x.x', seq:'2418955' },
  { time:'06:48:02', kind:'write',  actor:'Renata Coutinho',  verb:'salvou corrida',                             target:'runs/abc1f3', detail:'HGB · HC-2904 · 13.84 g/dL',                      ip:'10.0.4.12', seq:'2418942' },
  { time:'05:32:18', kind:'auth',   actor:'Diego R.',         verb:'tentativa de acesso negada',                 target:'/admin/users', detail:'role member, requer superAdmin',                  ip:'10.0.4.30', seq:'2418901' },
];

// ─── NOTIVISA portal ──────────────────────────────────────────────────────────

function NotivisaScreen() {
  return (
    <Shell page="notivisa">
      <PageHeader title="NOTIVISA · Notificação tecnovigilância"
        subtitle="Item NV-2026-014 · rascunho · campos obrigatórios marcados com asterisco"
        actions={<><Btn kind="ghost" size="md">Cancelar</Btn>
                   <Btn kind="secondary" size="md" icon={<I.Doc size={13}/>}>Salvar rascunho</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Upload size={13}/>}>Submeter ANVISA</Btn></>}/>

      <div className="px-8 py-6 grid grid-cols-[260px_1fr_300px] gap-6 h-[calc(100%-100px)] overflow-auto">
        {/* Form sections nav */}
        <aside>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{color:'var(--text-faint)'}}>Seções</div>
          <nav className="space-y-1">
            {[
              { id:'id',    label:'Identificação',          done:true },
              { id:'prod',  label:'Produto envolvido',      done:true },
              { id:'evt',   label:'Evento adverso',         active:true, errors:2 },
              { id:'pac',   label:'Paciente',               done:false },
              { id:'evid',  label:'Evidências',             done:false },
              { id:'rev',   label:'Revisão & assinatura',   done:false },
            ].map(s=>(
              <a key={s.id} className="flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[12.5px] cursor-pointer"
                 style={{
                   background: s.active?'var(--accent-tint)':'transparent',
                   color: s.active?'var(--accent-600)':s.done?'var(--text-body)':'var(--text-muted)',
                   fontWeight: s.active?600:500,
                 }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono shrink-0"
                      style={{
                        background: s.done?'var(--success-500)':s.active?'var(--accent-600)':'var(--surface-muted)',
                        color: s.done||s.active?'#fff':'var(--text-faint)',
                      }}>
                  {s.done ? <I.Check size={9} strokeWidth={3}/> : '·'}
                </span>
                <span className="flex-1">{s.label}</span>
                {s.errors && <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                                   style={{background:'var(--danger-50)', color:'var(--danger-500)'}}>{s.errors}</span>}
              </a>
            ))}
          </nav>

          <div className="mt-6 p-3 rounded-md" style={{background:'var(--accent-50)', border:'1px solid var(--accent-600)'}}>
            <div className="text-[11px] font-semibold" style={{color:'var(--accent-600)'}}>Pré-validado · ANVISA</div>
            <p className="text-[11px] mt-1 leading-snug" style={{color:'var(--text-body)'}}>
              Formulário segue RDC 67/2009 · cmpos obrigatórios serão verificados antes da submissão.
            </p>
          </div>
        </aside>

        {/* Form */}
        <Card title="Evento adverso · seção 3 de 6" padded={false}>
          <div className="p-5 space-y-5">
            <Field label="Data e hora da ocorrência *" mono>
              <input defaultValue="08/05/2026 06:49" className="w-full px-3 h-9 rounded-md font-mono text-[13px]"
                     style={{background:'var(--surface-muted)', color:'var(--text-strong)'}}/>
            </Field>

            <Field label="Tipo de evento *">
              <div className="grid grid-cols-3 gap-2">
                {['Erro de medição','Defeito de software','Defeito mecânico','Resultado discrepante','Quebra/queima','Outro'].map((t,i)=>(
                  <button key={t} className="px-3 h-9 text-[12.5px] rounded-md text-left"
                          style={{
                            background: i===0?'var(--accent-tint)':'var(--surface-card)',
                            color: i===0?'var(--accent-600)':'var(--text-body)',
                            border: i===0?'1px solid var(--accent-600)':'1px solid var(--border-soft)',
                            fontWeight: i===0?600:400,
                          }}>{t}</button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Gravidade *" error="Selecione uma opção">
                <select className="w-full px-3 h-9 rounded-md text-[13px]"
                        style={{background:'var(--surface-muted)', color:'var(--text-muted)', border:'1px solid var(--danger-500)'}}>
                  <option>—</option>
                </select>
              </Field>
              <Field label="Causou dano ao paciente? *">
                <div className="flex gap-2">
                  {['Não','Sim · sem sequela','Sim · com sequela','Óbito'].map(o=>(
                    <button key={o} className="flex-1 px-2 h-9 text-[12px] rounded-md"
                            style={{background:'var(--surface-muted)', color:'var(--text-body)', border:'1px solid var(--border-soft)'}}>{o}</button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Descrição livre do evento *">
              <textarea rows={5} defaultValue="Resultado de creatinina nível 2 (controle) apresentou desvio sistemático Westgard 1-3s recorrente nos últimos 5 dias. O equipamento Cobas c311 (SN 1842-09-A) já havia apresentado calibração vencida em D-2. Bloqueio automático de liberação foi acionado em 100% das corridas. Suspeita-se de drift na ótica de absorbância no comprimento 546 nm."
                        className="w-full p-3 rounded-md text-[13px] leading-relaxed"
                        style={{background:'var(--surface-muted)', color:'var(--text-body)', border:'1px solid var(--border-soft)'}}/>
              <div className="mt-1 flex justify-between text-[10px] font-mono" style={{color:'var(--text-faint)'}}>
                <span>458 / 4000 caracteres</span>
                <span>auto-salvo · 12:31</span>
              </div>
            </Field>

            <Field label="Vinculado a (NC interna)" hint="Opcional · facilita rastreabilidade">
              <input defaultValue="NC-2026-041" className="w-full px-3 h-9 rounded-md font-mono text-[13px]"
                     style={{background:'var(--accent-tint)', color:'var(--accent-600)', border:'1px solid var(--accent-600)'}}/>
            </Field>
          </div>

          <div className="px-5 py-3.5 flex items-center" style={{ borderTop:'1px solid var(--border-hairline)', background:'var(--surface-muted)' }}>
            <Btn kind="ghost" size="md" icon={<I.ChevL size={13}/>}>Anterior · Produto</Btn>
            <span className="ml-3 text-[11px]" style={{color:'var(--text-muted)'}}>2 campos pendentes</span>
            <Btn kind="primary" size="md" className="ml-auto">Próximo · Paciente <I.ChevR size={13}/></Btn>
          </div>
        </Card>

        {/* Right rail */}
        <aside className="space-y-4">
          <Card title="Resumo">
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Item</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>NV-2026-014</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Tipo</dt><dd style={{color:'var(--text-strong)'}}>Tecnovigilância</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Status</dt><dd><Badge tone="warning" dot={false}>Rascunho</Badge></dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Prazo legal</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>15 mai · D-2</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Progresso</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>2 / 6</dd></div>
            </dl>
            <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border-hairline)'}}>
              <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--surface-muted)'}}>
                <div className="h-full" style={{width:'33%', background:'var(--accent-600)'}}/>
              </div>
            </div>
          </Card>
          <Card title="Validações ANVISA" padded={false}>
            <ul>
              {[
                { ok:true,  text:'Identificação do estabelecimento' },
                { ok:true,  text:'CNPJ válido (formato + dígito)' },
                { ok:true,  text:'Produto com registro ANVISA' },
                { ok:false, text:'Gravidade não definida' },
                { ok:false, text:'Dano ao paciente não definido' },
              ].map((v,i)=>(
                <li key={i} className="px-4 py-2 flex items-center gap-2.5 text-[12px]"
                    style={{borderTop:i===0?'none':'1px solid var(--border-hairline)'}}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{background: v.ok?'var(--success-50)':'var(--danger-50)', color: v.ok?'var(--success-500)':'var(--danger-500)'}}>
                    {v.ok ? <I.Check size={10} strokeWidth={3}/> : <I.X size={10} strokeWidth={3}/>}
                  </span>
                  <span style={{color: v.ok?'var(--text-body)':'var(--text-strong)'}}>{v.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}

function Field({ label, children, hint, error, mono }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1.5" style={{color: error?'var(--danger-500)':'var(--text-strong)'}}>{label}</label>
      {children}
      {hint && <div className="mt-1 text-[10.5px]" style={{color:'var(--text-faint)'}}>{hint}</div>}
      {error && <div className="mt-1 text-[10.5px] font-medium" style={{color:'var(--danger-500)'}}>{error}</div>}
    </div>
  );
}

Object.assign(window, { NCScreen, AuditoriaScreen, NotivisaScreen, NCDetailDrawer, Field });
