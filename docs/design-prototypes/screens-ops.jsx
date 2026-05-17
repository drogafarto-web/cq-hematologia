/* global React, Card, KPI, Btn, Badge, PageHeader, Tabs, Seg, I, Shell */

// ─── EQUIPAMENTOS + CALIBRAÇÃO ────────────────────────────────────────────────

function EquipamentosScreen() {
  return (
    <Shell page="equipamentos">
      <PageHeader title="Equipamentos & calibração"
        subtitle="34 ativos · 3 calibrações a vencer em 7 dias · 1 vencida"
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Inventário</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Cadastrar</Btn></>}
        tabs={[
          { label:'Ativos',     count: 34, active:true },
          { label:'Manutenção', count: 2 },
          { label:'Desativados',count: 6 },
          { label:'Calibração agendada', count: 8 },
        ]}/>

      <div className="px-8 py-5 space-y-5 overflow-auto h-[calc(100%-150px)]">
        <div className="grid grid-cols-4 gap-4">
          <KPI label="MTBF médio"     value="412h" sub="↑ 6% vs trimestre"  accent="success"/>
          <KPI label="Disponibilidade" value="99.2%" sub="meta 98.5%"        accent="success"/>
          <KPI label="Vencendo"        value="3"     sub="próximos 7 dias"   accent="warning"/>
          <KPI label="Calibração vencida" value="1"  sub="Cobas c311 · D-2" accent="danger"/>
        </div>

        <Card title="Inventário" padded={false} actions={<Seg options={[{value:'todos',label:'Todos setores'},{value:'hema',label:'Hema'},{value:'bioq',label:'Bioq'},{value:'coag',label:'Coag'},{value:'imuno',label:'Imuno'}]} active="todos"/>}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{color:'var(--text-faint)'}}>
                {['Equipamento','Setor','SN','Fabricante','Status','Última calibração','Próxima','MTBF',''].map((h,i)=>(
                  <th key={i} className={`text-${i>3 && i<8?'left':i===8?'right':'left'} text-[10px] uppercase tracking-wider font-semibold py-2.5 ${i===0?'pl-5':''} ${i===8?'pr-5':''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EQUIPS.map((e,i)=>(
                <tr key={i} style={{borderTop:'1px solid var(--border-hairline)'}}>
                  <td className="py-3 pl-5">
                    <div className="font-medium" style={{color:'var(--text-strong)'}}>{e.name}</div>
                    <div className="text-[10.5px] font-mono mt-0.5" style={{color:'var(--text-faint)'}}>{e.model}</div>
                  </td>
                  <td className="py-3" style={{color:'var(--text-body)'}}>{e.sector}</td>
                  <td className="py-3 font-mono text-[11px]" style={{color:'var(--text-muted)'}}>{e.sn}</td>
                  <td className="py-3" style={{color:'var(--text-body)'}}>{e.mfr}</td>
                  <td className="py-3"><Badge tone={e.status==='OK'?'success':e.status==='Vencida'?'danger':e.status==='A vencer'?'warning':'neutral'}>{e.status}</Badge></td>
                  <td className="py-3 font-mono text-[11px]" style={{color:'var(--text-muted)'}}>{e.last}</td>
                  <td className="py-3 font-mono text-[11px]" style={{color: e.dueTone==='danger'?'var(--danger-500)':e.dueTone==='warning'?'var(--warning-500)':'var(--text-body)'}}>{e.next}</td>
                  <td className="py-3 font-mono tabular-nums" style={{color:'var(--text-body)'}}>{e.mtbf}h</td>
                  <td className="py-3 pr-5 text-right"><Btn kind="ghost" size="sm">Ver →</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </Shell>
  );
}

const EQUIPS = [
  { name:'Cobas c311',    model:'Roche · Bioquímica',    sector:'Bioquímica',  sn:'1842-09-A',  mfr:'Roche',  status:'Vencida',  last:'28 abr 2026', next:'11 mai · -2d', dueTone:'danger',  mtbf:'389' },
  { name:'Cobas c311',    model:'Roche · Bioquímica · backup', sector:'Bioquímica', sn:'1842-09-B', mfr:'Roche',  status:'A vencer', last:'05 mai 2026', next:'19 mai · D+6', dueTone:'warning', mtbf:'401' },
  { name:'Sysmex XN-1000', model:'Hematologia',          sector:'Hematologia', sn:'21CT-1129',  mfr:'Sysmex', status:'OK',       last:'07 mai 2026', next:'21 mai · D+8', dueTone:'',        mtbf:'512' },
  { name:'Mindray BC-6800',model:'Hematologia · backup', sector:'Hematologia', sn:'BC-77011',    mfr:'Mindray',status:'OK',       last:'04 mai 2026', next:'18 mai · D+5', dueTone:'warning', mtbf:'448' },
  { name:'Stago Compact',  model:'Coagulação',           sector:'Coagulação',  sn:'ST-44882',    mfr:'Stago',  status:'OK',       last:'29 abr 2026', next:'27 mai · D+14', dueTone:'',       mtbf:'401' },
  { name:'Cobas e601',     model:'Imunoensaios',         sector:'Imuno',       sn:'CB-99-188',   mfr:'Roche',  status:'OK',       last:'03 mai 2026', next:'17 mai · D+4', dueTone:'warning', mtbf:'522' },
  { name:'Centrífuga Excelsa II', model:'Pré-analítico', sector:'Pré/Pós',    sn:'EX-3344',     mfr:'Fanem',  status:'Manut.',   last:'15 mar 2026', next:'—',           dueTone:'',        mtbf:'212' },
];

// ─── TEMPERATURA ──────────────────────────────────────────────────────────────

function TemperaturaScreen() {
  return (
    <Shell page="temperatura">
      <PageHeader title="Controle de temperatura"
        subtitle="12 sensores ativos · 1 alerta nas últimas 24h · sincronização em tempo real"
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Relatório 24h</Btn>
                   <Btn kind="secondary" size="md" icon={<I.Print size={13}/>}>Imprimir mapa</Btn></>}/>

      <div className="px-8 py-5 grid grid-cols-[1fr_360px] gap-5 h-[calc(100%-100px)] overflow-auto">
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            <SensorCard name="Geladeira reagentes" id="T-04" temp="6.2" range="2 – 8 °C" alert tempColor="var(--warning-500)" />
            <SensorCard name="Freezer -20°C · A"  id="T-07" temp="-18.4" range="-25 – -15 °C" tempColor="var(--success-500)" />
            <SensorCard name="Sala bioquímica"     id="T-11" temp="21.4" range="18 – 24 °C" tempColor="var(--success-500)" />
            <SensorCard name="Sala hematologia"    id="T-12" temp="22.1" range="18 – 24 °C" tempColor="var(--success-500)" />
            <SensorCard name="Geladeira amostras"  id="T-05" temp="4.8"  range="2 – 8 °C"  tempColor="var(--success-500)" />
            <SensorCard name="Freezer -80°C"       id="T-09" temp="-78.2" range="-86 – -70 °C" tempColor="var(--success-500)" />
          </div>

          <Card padded={false}>
            <div className="px-5 py-3.5 flex items-center" style={{borderBottom:'1px solid var(--border-hairline)'}}>
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase" style={{color:'var(--text-faint)'}}>Geladeira reagentes · T-04</div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[12px]">
                  <span style={{color:'var(--text-body)'}}>Pico <strong style={{color:'var(--warning-500)'}}>9.4 °C</strong> às 04:18</span>
                  <span style={{color:'var(--text-faint)'}}>Média 6.1 °C</span>
                  <span style={{color:'var(--text-faint)'}}>Duração 12 min fora da faixa</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Seg options={[{value:'24h',label:'24h'},{value:'7d',label:'7d'},{value:'30d',label:'30d'}]} active="24h"/>
                <Btn kind="ghost" size="sm" icon={<I.Sync size={12}/>}>ao vivo</Btn>
              </div>
            </div>
            <TempChart />
            <div className="px-5 pb-3 flex items-center gap-4 text-[10.5px]" style={{color:'var(--text-faint)'}}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-px" style={{background:'var(--accent-600)'}}/>Leitura</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-px" style={{background:'var(--success-500)'}}/>Faixa aceita</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-px" style={{background:'var(--warning-500)'}}/>Limite superior</span>
              <span className="ml-auto font-mono">12 pontos · 1 leitura / 5 min · sensor Sitrad PRO</span>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Eventos · 24h" padded={false}>
            <ul>
              {[
                { tone:'warning', title:'Excursão T-04', body:'9.4 °C às 04:18 · 12 min', when:'há 3h' },
                { tone:'neutral', title:'Calibração T-07', body:'Aprovada · padrão NIST', when:'ontem 18:30' },
                { tone:'success', title:'Retorno à faixa T-04', body:'6.8 °C às 04:30', when:'há 3h' },
                { tone:'neutral', title:'Bateria sensor T-09', body:'12% restante', when:'há 1d' },
              ].map((e,i)=>(
                <li key={i} className="px-4 py-3 flex gap-3"
                    style={{borderTop: i===0?'none':'1px solid var(--border-hairline)'}}>
                  <span className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                        style={{background: e.tone==='warning'?'var(--warning-500)':e.tone==='success'?'var(--success-500)':'var(--text-faint)'}}/>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium" style={{color:'var(--text-strong)'}}>{e.title}</div>
                    <div className="text-[11px] mt-0.5" style={{color:'var(--text-muted)'}}>{e.body}</div>
                  </div>
                  <span className="text-[10.5px] font-mono" style={{color:'var(--text-faint)'}}>{e.when}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Mapa de risco">
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({length:12}).map((_,i)=>{
                const t = i===0?'warning':(i===4||i===8?'success':'success');
                return (
                  <div key={i} className="aspect-square rounded flex items-center justify-center text-[10px] font-mono"
                       style={{ background: t==='warning'?'var(--warning-50)':'var(--success-50)',
                                color: t==='warning'?'var(--warning-500)':'var(--success-500)',
                                border: t==='warning'?'1px solid var(--warning-500)':'1px solid var(--border-soft)'}}>
                    T-{String(i+1).padStart(2,'0')}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-[11px]" style={{color:'var(--text-muted)'}}>
              <strong style={{color:'var(--text-strong)'}}>11</strong> de 12 sensores dentro da faixa nas últimas 24h.
            </div>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}

function SensorCard({ name, id, temp, range, alert, tempColor }) {
  return (
    <div className="rounded-lg p-3" style={{ background:'var(--surface-card)', border: alert?'1px solid var(--warning-500)':'1px solid var(--border-soft)'}}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono" style={{color:'var(--text-faint)'}}>{id}</div>
        {alert && <Badge tone="warning" dot={false}>excursão</Badge>}
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium" style={{color:'var(--text-strong)'}}>{name}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold tabular-nums tracking-tight" style={{color: tempColor}}>{temp}</span>
        <span className="text-[12px] font-mono" style={{color:'var(--text-faint)'}}>°C</span>
      </div>
      <div className="mt-1 text-[10.5px] font-mono" style={{color:'var(--text-faint)'}}>{range}</div>
    </div>
  );
}

function TempChart() {
  const W=820, H=240, padL=40, padR=12, padT=14, padB=24;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const tempMin = 0, tempMax = 12;
  const ok = { lo:2, hi:8 };
  const yToPx = v => padT + (1 - (v-tempMin)/(tempMax-tempMin)) * innerH;
  const N = 96; // 24h * 4 (15min)
  const pts = Array.from({length:N}, (_,i) => {
    const hour = i*15/60;
    let v = 6 + Math.sin(hour/2)*0.6 + (Math.random()-0.5)*0.4;
    if (hour > 4.0 && hour < 4.5) v = 9.4 - (hour-4.0)*4 + Math.random()*0.4;
    return { x: i, v };
  });
  const xToPx = i => padL + (i/(N-1))*innerW;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px]">
      <rect x={padL} y={yToPx(ok.hi)} width={innerW} height={yToPx(ok.lo)-yToPx(ok.hi)} fill="var(--success-50)"/>
      <line x1={padL} y1={yToPx(ok.hi)} x2={W-padR} y2={yToPx(ok.hi)} stroke="var(--warning-500)" strokeDasharray="2 4"/>
      <line x1={padL} y1={yToPx(ok.lo)} x2={W-padR} y2={yToPx(ok.lo)} stroke="var(--warning-500)" strokeDasharray="2 4"/>
      {[2,4,6,8,10].map(v => (
        <g key={v}>
          <line x1={padL} y1={yToPx(v)} x2={W-padR} y2={yToPx(v)} stroke="var(--border-hairline)"/>
          <text x={padL-6} y={yToPx(v)+3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">{v}°</text>
        </g>
      ))}
      {[0,6,12,18,24].map(h=>(
        <text key={h} x={padL + (h/24)*innerW} y={H-8} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-faint)">{String(h).padStart(2,'0')}:00</text>
      ))}
      <polyline fill="none" stroke="var(--accent-600)" strokeWidth="1.6"
                points={pts.map(p=>`${xToPx(p.x)},${yToPx(p.v)}`).join(' ')} />
      {/* Highlight excursion */}
      {pts.filter(p=>p.v > ok.hi).map((p,i)=>(
        <circle key={i} cx={xToPx(p.x)} cy={yToPx(p.v)} r="3.4" fill="var(--warning-500)" stroke="var(--surface-card)" strokeWidth="1.2"/>
      ))}
    </svg>
  );
}

// ─── TREINAMENTOS ─────────────────────────────────────────────────────────────

function TreinamentosScreen() {
  return (
    <Shell page="treinamentos">
      <PageHeader title="Educação continuada"
        subtitle="14 colaboradores · 8 trilhas ativas · 84% taxa de conformidade"
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Matriz de treinamentos</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Atribuir trilha</Btn></>}
        tabs={[
          { label:'Visão geral', active:true },
          { label:'Trilhas',     count: 8 },
          { label:'Por colaborador', count: 14 },
          { label:'Vencidos',    count: 3 },
        ]}/>

      <div className="px-8 py-5 space-y-5 overflow-auto h-[calc(100%-150px)]">
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Conformidade" value="84%" sub="meta 90%" accent="warning"/>
          <KPI label="Trilhas concluídas" value="62" sub="↑ 5 esta semana" accent="success"/>
          <KPI label="Em andamento"    value="18" sub="—" accent="info"/>
          <KPI label="Vencidas"        value="3"  sub="ação imediata" accent="danger"/>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card title="Matriz · setor × trilha" className="col-span-2" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{color:'var(--text-faint)'}}>
                    <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3 pl-5 w-[140px]">Trilha</th>
                    {SECTORS.map(s=>(
                      <th key={s} className="text-center text-[10px] uppercase tracking-wider font-semibold py-3 px-2">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAINING_MATRIX.map((row,i)=>(
                    <tr key={i} style={{borderTop:'1px solid var(--border-hairline)'}}>
                      <td className="py-2.5 pl-5">
                        <div className="text-[12px] font-medium" style={{color:'var(--text-strong)'}}>{row.title}</div>
                        <div className="text-[10.5px] font-mono mt-0.5" style={{color:'var(--text-faint)'}}>{row.code}</div>
                      </td>
                      {row.cells.map((c,j)=>(
                        <td key={j} className="py-2.5 px-2 text-center">
                          {c==='ok' && <span className="inline-flex w-5 h-5 rounded-full items-center justify-center" style={{background:'var(--success-50)', color:'var(--success-500)'}}><I.Check size={11} strokeWidth={3}/></span>}
                          {c==='wip'&& <span className="inline-flex w-5 h-5 rounded-full items-center justify-center" style={{background:'var(--warning-50)', color:'var(--warning-500)'}}><I.Clock size={10}/></span>}
                          {c==='out'&& <span className="inline-flex w-5 h-5 rounded-full items-center justify-center" style={{background:'var(--danger-50)', color:'var(--danger-500)'}}><I.X size={11} strokeWidth={3}/></span>}
                          {c==='na' && <span className="text-[11px]" style={{color:'var(--text-faint)'}}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 flex items-center gap-4 text-[10.5px]" style={{color:'var(--text-faint)', borderTop:'1px solid var(--border-hairline)'}}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:'var(--success-500)'}}/>Concluída · em vigência</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:'var(--warning-500)'}}/>Em andamento</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:'var(--danger-500)'}}/>Vencida</span>
            </div>
          </Card>

          <Card title="Próximos vencimentos" padded={false}>
            <ul>
              {[
                { who:'Carlos Marques', what:'NR-32 · Resíduos biológicos', due:'D-2', tone:'danger' },
                { who:'Ana Pereira',    what:'POP-BIOQ-014',                due:'D-5', tone:'warning' },
                { who:'Diego R.',       what:'Boas práticas laboratoriais', due:'D-8', tone:'warning' },
                { who:'Suzana L.',      what:'LGPD · acesso a dados',       due:'D-12',tone:'' },
                { who:'Renata C.',      what:'Westgard avançado',           due:'D-18',tone:'' },
              ].map((r,i)=>(
                <li key={i} className="px-4 py-2.5 flex items-center gap-3" style={{borderTop: i===0?'none':'1px solid var(--border-hairline)'}}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                       style={{background:'var(--accent-600)'}}>{r.who.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium truncate" style={{color:'var(--text-strong)'}}>{r.who}</div>
                    <div className="text-[10.5px] truncate" style={{color:'var(--text-muted)'}}>{r.what}</div>
                  </div>
                  <span className="text-[11px] font-mono shrink-0"
                        style={{color: r.tone==='danger'?'var(--danger-500)':r.tone==='warning'?'var(--warning-500)':'var(--text-body)'}}>{r.due}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

const SECTORS = ['Hema','Bioq','Coag','Imuno','Uro','Pré/Pós'];
const TRAINING_MATRIX = [
  { title:'Westgard avançado',     code:'POP-CQI-014', cells:['ok','ok','ok','ok','na','na'] },
  { title:'NR-32 Resíduos',        code:'NR-32',        cells:['ok','ok','out','ok','ok','ok'] },
  { title:'POP-BIOQ-014',          code:'POP-BIOQ-014', cells:['na','wip','na','na','na','na'] },
  { title:'Boas práticas lab.',    code:'BPL-2024',     cells:['ok','ok','ok','wip','ok','ok'] },
  { title:'LGPD · acesso dados',   code:'LGPD-A',       cells:['ok','ok','ok','wip','ok','wip'] },
  { title:'Biossegurança nível 2', code:'NB-2',         cells:['ok','ok','ok','ok','ok','ok'] },
  { title:'Operação Cobas c311',   code:'EQ-BQ-001',    cells:['na','ok','na','na','na','na'] },
  { title:'Operação Sysmex XN',    code:'EQ-HE-001',    cells:['ok','na','na','na','na','na'] },
];

// ─── RISCOS ───────────────────────────────────────────────────────────────────

function RiscosScreen() {
  return (
    <Shell page="riscos">
      <PageHeader title="Gestão de riscos · matriz 5×5"
        subtitle="ISO 31000 · 32 riscos mapeados · 4 críticos · revisão mensal"
        actions={<><Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Plano de mitigação</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Cadastrar risco</Btn></>}/>

      <div className="px-8 py-5 grid grid-cols-[1fr_440px] gap-5 h-[calc(100%-100px)] overflow-auto">
        <Card title="Matriz probabilidade × impacto">
          <RiskMatrix/>
        </Card>

        <Card title="Riscos críticos · revisão pendente" padded={false}>
          <ul>
            {RISKS.map((r,i)=>(
              <li key={i} className="px-4 py-3 flex items-start gap-3"
                  style={{borderTop:i===0?'none':'1px solid var(--border-hairline)'}}>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                      style={{background:'var(--surface-muted)', color:'var(--text-muted)'}}>{r.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-tight" style={{color:'var(--text-strong)'}}>{r.title}</div>
                  <div className="text-[11px] mt-1" style={{color:'var(--text-muted)'}}>{r.desc}</div>
                  <div className="mt-2 flex items-center gap-2 text-[10.5px]" style={{color:'var(--text-faint)'}}>
                    <span className="font-mono">P{r.p} × I{r.i} = {r.p*r.i}</span>
                    <span>·</span>
                    <span>{r.owner}</span>
                    <span>·</span>
                    <span>{r.action}</span>
                  </div>
                </div>
                <span className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-[11px] font-mono font-semibold"
                      style={{background: riskColor(r.p*r.i, 0.16), color: riskColor(r.p*r.i, 1)}}>{r.p*r.i}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Shell>
  );
}

function riskColor(score, alpha=1) {
  if (score >= 15) return alpha === 1 ? '#EF4444' : `rgba(239, 68, 68, ${alpha})`;
  if (score >= 8)  return alpha === 1 ? '#F59E0B' : `rgba(245, 158, 11, ${alpha})`;
  if (score >= 4)  return alpha === 1 ? '#3B82F6' : `rgba(59, 130, 246, ${alpha})`;
  return alpha === 1 ? '#10B981' : `rgba(16, 185, 129, ${alpha})`;
}

function RiskMatrix() {
  const counts = {
    "5,5":1, "5,4":2, "4,5":1,
    "4,4":2, "5,3":1, "3,5":0,
    "4,3":2, "3,4":3, "5,2":1, "2,5":1,
    "3,3":4, "4,2":2, "2,4":1, "5,1":0, "1,5":0,
    "3,2":3, "2,3":2, "4,1":1, "1,4":1,
    "2,2":3, "3,1":1, "1,3":2,
    "2,1":1, "1,2":2, "1,1":1,
  };
  return (
    <div>
      <div className="flex">
        <div className="w-12"/>
        <div className="flex-1 grid grid-cols-5 gap-1.5 text-[10px] uppercase tracking-wider text-center font-semibold" style={{color:'var(--text-faint)'}}>
          {['Insig.','Menor','Mod.','Maior','Sev.'].map(l=><div key={l}>{l}</div>)}
        </div>
      </div>
      <div className="flex mt-1.5">
        <div className="w-12 flex flex-col-reverse justify-between text-[10px] uppercase tracking-wider font-semibold py-2" style={{color:'var(--text-faint)'}}>
          {['Raro','Improv.','Possível','Provável','Quase certo'].map(l=><div key={l} className="-rotate-90 origin-center whitespace-nowrap h-0">{l}</div>)}
        </div>
        <div className="flex-1 grid grid-cols-5 grid-rows-5 gap-1.5 matrix-grid">
          {Array.from({length:25}).map((_,i)=>{
            const r = 5 - Math.floor(i/5);
            const c = (i%5) + 1;
            const score = r*c;
            const k = `${r},${c}`;
            const count = counts[k] || 0;
            return (
              <div key={i} className="aspect-square rounded flex items-center justify-center text-[14px] font-mono font-semibold relative"
                   style={{ background: riskColor(score, 0.12), color: count?riskColor(score, 1):'transparent', border: '1px solid '+riskColor(score, 0.25) }}>
                {count>0 ? count : ''}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4 text-[10.5px]" style={{color:'var(--text-faint)'}}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{background:riskColor(2,0.18), border:`1px solid ${riskColor(2,0.3)}`}}/>Baixo</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{background:riskColor(6,0.18), border:`1px solid ${riskColor(6,0.3)}`}}/>Atenção</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{background:riskColor(10,0.18), border:`1px solid ${riskColor(10,0.3)}`}}/>Alto</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{background:riskColor(20,0.18), border:`1px solid ${riskColor(20,0.3)}`}}/>Crítico</span>
        <span className="ml-auto font-mono">32 riscos · última revisão 02 mai 2026</span>
      </div>
    </div>
  );
}

const RISKS = [
  { id:'R-014', title:'Falha do equipamento principal sem backup', desc:'Cobas c311 único para CRE/GLU. Sem redundância imediata.', p:4, i:5, owner:'Renata C.', action:'Mitigação · contratar backup' },
  { id:'R-009', title:'Vazamento de dados via portal médico',      desc:'Token JWT com escopo amplo · refresh > 24h',                   p:3, i:5, owner:'Diego R.',  action:'Aceitar · revisão Q3' },
  { id:'R-021', title:'Excursão T-04 não monitorada',               desc:'Sensor com bateria < 20% · alerta tardio',                     p:5, i:4, owner:'Carlos M.', action:'Mitigação · troca em D-3' },
  { id:'R-031', title:'CAPA não fechada em prazo legal',            desc:'2 CAPAs vencidas > 30d · risco regulatório',                   p:4, i:4, owner:'Renata C.', action:'Tratar · sprint Q2' },
];

// ─── LIBERAÇÃO (pré/pós-analítico) ────────────────────────────────────────────

function LiberacaoScreen() {
  return (
    <Shell page="liberacao">
      <PageHeader title="Liberação de resultados"
        subtitle="48 amostras pendentes · 6 com bloqueio Westgard · 2 com valor crítico"
        actions={<><Btn kind="secondary" size="md">Imprimir lote</Btn>
                   <Btn kind="primary"   size="md" icon={<I.Check size={13}/>}>Liberar selecionados (3)</Btn></>}
        tabs={[
          { label:'Pendentes',  count:48, active:true },
          { label:'Bloqueadas', count:6 },
          { label:'Críticas',   count:2 },
          { label:'Liberadas hoje', count:312 },
        ]}/>

      <div className="px-8 py-4 flex items-center gap-2" style={{borderBottom:'1px solid var(--border-soft)'}}>
        <Seg options={[{value:'all',label:'Todos'},{value:'urg',label:'Urgência'},{value:'rot',label:'Rotina'}]} active="all"/>
        <Seg options={[{value:'all',label:'Todos setores'},{value:'h',label:'Hema'},{value:'b',label:'Bioq'},{value:'c',label:'Coag'}]} active="all"/>
        <span className="ml-auto text-[11px]" style={{color:'var(--text-muted)'}}><strong className="font-semibold tabular-nums" style={{color:'var(--text-strong)'}}>3</strong> selecionadas</span>
      </div>

      <div className="overflow-auto h-[calc(100%-180px)]">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10" style={{background:'var(--surface-card)'}}>
            <tr style={{color:'var(--text-faint)', borderBottom:'1px solid var(--border-soft)'}}>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3 pl-8 w-[36px]"><input type="checkbox"/></th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Amostra · Paciente</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Exames</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Status técnico</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-3">Alertas</th>
              <th className="text-right text-[10px] uppercase tracking-wider font-semibold py-3 pr-8">Coletada há</th>
            </tr>
          </thead>
          <tbody>
            {LIB.map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid var(--border-hairline)', background: r.selected?'var(--accent-tint)':'transparent'}}>
                <td className="py-3 pl-8"><input type="checkbox" defaultChecked={r.selected}/></td>
                <td className="py-3">
                  <div className="font-mono text-[11.5px]" style={{color:'var(--text-strong)'}}>{r.code}</div>
                  <div className="text-[11px]" style={{color:'var(--text-muted)'}}>{r.patient}</div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.exams.map(e=>(
                      <span key={e} className="font-mono text-[10.5px] px-1.5 py-0.5 rounded"
                            style={{background:'var(--surface-muted)', color:'var(--text-muted)'}}>{e}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3"><Badge tone={r.status==='OK'?'success':r.status==='Bloqueada'?'danger':r.status==='Crítica'?'danger':'warning'}>{r.status}</Badge></td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.alerts.map((a,j)=>(
                      <span key={j} className="text-[10.5px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: a.tone==='danger'?'var(--danger-50)':a.tone==='warning'?'var(--warning-50)':'var(--surface-muted)',
                                      color: a.tone==='danger'?'var(--danger-500)':a.tone==='warning'?'var(--warning-500)':'var(--text-muted)' }}>
                        {a.t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-8 text-right font-mono text-[11.5px]" style={{color: r.lateTone||'var(--text-body)'}}>{r.collected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

const LIB = [
  { code:'AM-2026-44811', patient:'Carlos S., 62 anos · M', exams:['HGB','HCT','PLT','GLU','CRE'], status:'OK',        alerts:[{t:'urgente', tone:'warning'}], collected:'42 min', selected:true },
  { code:'AM-2026-44812', patient:'Mariana A., 35 anos · F', exams:['TSH','T4L','GLU'],            status:'OK',        alerts:[], collected:'1h 12m', selected:true },
  { code:'AM-2026-44813', patient:'João P., 71 anos · M',    exams:['CRE','UREA','K','Na'],       status:'Bloqueada', alerts:[{t:'1-3s CRE', tone:'danger'}], collected:'1h 24m' },
  { code:'AM-2026-44814', patient:'Ana B., 28 anos · F',      exams:['TP','TTPA','INR'],           status:'OK',        alerts:[], collected:'58 min', selected:true },
  { code:'AM-2026-44815', patient:'Rafael L., 53 anos · M',   exams:['GLU','HBA1C','CRE'],         status:'Crítica',   alerts:[{t:'GLU 412', tone:'danger'}, {t:'crítico', tone:'danger'}], collected:'34 min' },
  { code:'AM-2026-44816', patient:'Beatriz N., 19 anos · F',  exams:['HGB','HCT','RBC','PLT'],     status:'OK',        alerts:[], collected:'2h 4m', lateTone:'var(--warning-500)' },
  { code:'AM-2026-44817', patient:'Pedro M., 44 anos · M',    exams:['CRE','UREA'],                status:'Pendente',  alerts:[{t:'aguarda 2ª medida', tone:'warning'}], collected:'1h 51m' },
  { code:'AM-2026-44818', patient:'Lucia F., 67 anos · F',    exams:['HGB','HCT','PLT'],           status:'OK',        alerts:[], collected:'15 min' },
];

Object.assign(window, { EquipamentosScreen, TemperaturaScreen, TreinamentosScreen, RiscosScreen, LiberacaoScreen, TempChart, RiskMatrix });
