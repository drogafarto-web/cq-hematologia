/* global React, Card, KPI, Btn, Badge, PageHeader, Tabs, Seg, I, Shell */

// ─── HUB / Dashboard ──────────────────────────────────────────────────────────

function HubScreen() {
  return (
    <Shell page="hub">
      <PageHeader
        title="Visão geral · Labclin Centro"
        subtitle={<>Terça, 13 mai 2026 · <span className="font-mono">07:42 BRT</span> · 12 corridas pendentes nas próximas 4h</>}
        actions={<>
          <Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>Exportar</Btn>
          <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Nova corrida</Btn>
        </>}
        tabs={[
          { label: 'Hoje', active: true },
          { label: 'Esta semana' },
          { label: 'Mês corrente' },
          { label: 'Todos os setores', count: 6 },
        ]}
      />

      <div className="px-8 py-5 space-y-5 overflow-auto h-[calc(100%-128px)]">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Corridas hoje" value="42" sub="↑ 8 vs ontem" accent="info" spark={[.3,.5,.4,.6,.5,.7,.8]} />
          <KPI label="Taxa de aprovação" value="96.4%" sub="Westgard · 28d" accent="success" spark={[.7,.8,.75,.85,.9,.86,.92]} />
          <KPI label="NCs abertas" value="7" sub="3 vencidas · 2 críticas" accent="danger"  spark={[.5,.6,.4,.7,.8,.5,.6]} />
          <KPI label="CAPAs em prazo" value="89%" sub="22 ativas · 4 a vencer" accent="warning" spark={[.4,.6,.5,.7,.6,.55,.5]} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Operação em andamento */}
          <Card className="col-span-2" title="Operação em andamento"
                actions={<Seg options={[{value:'all',label:'Todos'},{value:'hema',label:'Hema'},{value:'bioq',label:'Bioquímica'},{value:'coag',label:'Coag'}]} active="all" />}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color:'var(--text-faint)' }}>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2.5 pl-1">Setor</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2.5">Analito · Lote</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2.5">Nível</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2.5">Status</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-semibold pb-2.5 pr-1">Iniciado</th>
                </tr>
              </thead>
              <tbody>
                {OPS_ROWS.map((r,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid var(--border-hairline)'}}>
                    <td className="py-2.5 pl-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-1 h-4 rounded-sm" style={{ background: r.sectorColor }} />
                        <span style={{color:'var(--text-body)'}}>{r.sector}</span>
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[12px]" style={{ color:'var(--text-strong)' }}>{r.analyte} <span style={{color:'var(--text-faint)'}}>· {r.lot}</span></td>
                    <td className="py-2.5">
                      <span className="font-mono text-[11px] inline-flex items-center gap-1.5" style={{color:'var(--text-muted)'}}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{background: r.levelColor}} />
                        Nv {r.level}
                      </span>
                    </td>
                    <td className="py-2.5"><Badge tone={r.tone}>{r.status}</Badge></td>
                    <td className="py-2.5 text-right pr-1 font-mono text-[11px]" style={{color:'var(--text-muted)'}}>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Alertas */}
          <Card title="Alertas" padded={false}>
            <ul>
              {ALERTS.map((a,i)=>(
                <li key={i} className="px-4 py-3 flex items-start gap-3" style={{ borderTop: i===0?'none':'1px solid var(--border-hairline)' }}>
                  <span className="mt-0.5 w-7 h-7 rounded-md inline-flex items-center justify-center shrink-0"
                        style={{ background: `var(--${a.tone}-50)`, color: `var(--${a.tone}-500)` }}>
                    <I.Triangle size={14}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-tight" style={{color:'var(--text-strong)'}}>{a.title}</div>
                    <div className="text-[11px] mt-1" style={{color:'var(--text-muted)'}}>{a.body}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono" style={{color:'var(--text-faint)'}}>
                      <I.Clock size={10}/> {a.time}
                      <span>·</span> <span>{a.module}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-4">
          <Card title="Westgard · últimos 7 dias" actions={<button className="text-[11px] font-medium" style={{color:'var(--accent-600)'}}>Detalhes →</button>}>
            <WestgardSpark />
          </Card>

          <Card title="Conformidade RDC 786/302">
            <div className="space-y-3">
              {COMPL.map((c,i)=>(
                <div key={i} className="flex items-center gap-3">
                  <div className="text-[11px] w-24 shrink-0" style={{color:'var(--text-muted)'}}>{c.label}</div>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'var(--surface-muted)' }}>
                    <div className="h-full rounded-full" style={{ width:`${c.pct}%`, background: c.pct>=90?'var(--success-500)':c.pct>=70?'var(--warning-500)':'var(--danger-500)' }} />
                  </div>
                  <div className="text-[11px] w-9 text-right font-mono tabular-nums" style={{color:'var(--text-strong)'}}>{c.pct}%</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Próximas calibrações" actions={<Badge tone="warning" dot={false}>3 a vencer</Badge>}>
            <ul className="space-y-2.5">
              {CALIBS.map((c,i)=>(
                <li key={i} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-tight" style={{color:'var(--text-strong)'}}>{c.equip}</div>
                    <div className="text-[10px] font-mono mt-0.5" style={{color:'var(--text-faint)'}}>{c.serial}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono tabular-nums" style={{color: c.urgent?'var(--danger-500)':'var(--text-body)'}}>{c.due}</div>
                    <div className="text-[10px] mt-0.5" style={{color:'var(--text-faint)'}}>{c.tech}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

const OPS_ROWS = [
  { sector:'Hematologia', sectorColor:'#8B5CF6', analyte:'HGB', lot:'HC-2904',  level:1, levelColor:'#10B981', status:'Aprovada', tone:'success', time:'06:48' },
  { sector:'Hematologia', sectorColor:'#8B5CF6', analyte:'HGB', lot:'HC-2904',  level:2, levelColor:'#F59E0B', status:'Aviso 1-2s', tone:'warning', time:'06:48' },
  { sector:'Bioquímica',  sectorColor:'#0EA5E9', analyte:'GLU', lot:'BQ-1812',  level:1, levelColor:'#10B981', status:'Aprovada', tone:'success', time:'07:12' },
  { sector:'Bioquímica',  sectorColor:'#0EA5E9', analyte:'CRE', lot:'BQ-1812',  level:2, levelColor:'#F59E0B', status:'Rejeitada · 1-3s', tone:'danger', time:'07:15' },
  { sector:'Coagulação',  sectorColor:'#EC4899', analyte:'TP',  lot:'CG-0457',  level:1, levelColor:'#10B981', status:'Em andamento', tone:'info', time:'07:31' },
  { sector:'Imuno',       sectorColor:'#10B981', analyte:'TSH', lot:'IM-3320',  level:2, levelColor:'#F59E0B', status:'Aprovada', tone:'success', time:'07:34' },
];

const ALERTS = [
  { tone:'danger', title:'Westgard 1-3s — Creatinina nível 2', body:'Corrida rejeitada. Bloqueio automático de liberação até reanálise.', time:'há 12 min', module:'CQI / Bioquímica' },
  { tone:'warning', title:'Temperatura geladeira reagentes', body:'Pico de 9.4 °C às 04:18. Faixa: 2–8 °C. Trend retornou em 12 min.', time:'há 3h', module:'Temperatura' },
  { tone:'warning', title:'Calibração Cobas c311 vencida', body:'Última: 28 abr. Periodicidade 14 dias. Bloqueio em 2 dias.', time:'hoje', module:'Equipamentos' },
  { tone:'danger', title:'NC-2026-041 sem CAPA atribuída', body:'Não conformidade crítica aberta há 5 dias.', time:'há 5d', module:'NC' },
];

const COMPL = [
  { label:'CQI conforme', pct: 96 },
  { label:'CEQ entregue', pct: 91 },
  { label:'Calibração',   pct: 78 },
  { label:'Treinamentos', pct: 84 },
  { label:'Documentação', pct: 92 },
];

const CALIBS = [
  { equip:'Cobas c311 · Bioquímica', serial:'SN 1842-09-A', due:'D-2', urgent:true, tech:'Ana P.' },
  { equip:'Sysmex XN-1000 · Hema',   serial:'SN 21CT-1129',  due:'D-5', tech:'Carlos M.' },
  { equip:'Mindray BC-6800 · Hema',  serial:'SN BC-77011',   due:'D-9', tech:'Ana P.' },
  { equip:'Stago Compact · Coag',    serial:'SN ST-44882',   due:'D-12', tech:'Renata C.' },
];

function WestgardSpark() {
  const bars = [
    { day:'Qua', ap: 42, av: 1, rj: 0 },
    { day:'Qui', ap: 39, av: 2, rj: 1 },
    { day:'Sex', ap: 47, av: 0, rj: 0 },
    { day:'Sáb', ap: 18, av: 1, rj: 0 },
    { day:'Dom', ap: 12, av: 0, rj: 0 },
    { day:'Seg', ap: 44, av: 3, rj: 1 },
    { day:'Ter', ap: 35, av: 1, rj: 2 },
  ];
  const max = 50;
  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {bars.map((b,i)=>{
        const tot = b.ap + b.av + b.rj;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex flex-col-reverse items-stretch h-24 rounded overflow-hidden"
                 style={{ background:'var(--surface-muted)' }}>
              <div style={{ background:'var(--success-500)', height: `${(b.ap/max)*100}%` }} />
              <div style={{ background:'var(--warning-500)', height: `${(b.av/max)*100}%` }} />
              <div style={{ background:'var(--danger-500)',  height: `${(b.rj/max)*100}%` }} />
            </div>
            <div className="text-[10px] font-mono" style={{color:'var(--text-faint)'}}>{b.day}</div>
            <div className="text-[10px] tabular-nums" style={{color: b.rj>0?'var(--danger-500)':'var(--text-muted)'}}>{tot}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ANALYZER / CQI — Levey-Jennings + Westgard ────────────────────────────────

function AnalyzerScreen() {
  return (
    <Shell page="analyzer">
      <PageHeader
        title="Análise · HGB · Lote HC-2904"
        subtitle={<>Sysmex XN-1000 · Hematologia · 28 dias · <span className="font-mono">N=84 medidas</span></>}
        actions={<>
          <Btn kind="secondary" size="md" icon={<I.Print size={13}/>}>Imprimir relatório</Btn>
          <Btn kind="secondary" size="md" icon={<I.Download size={13}/>}>PDF</Btn>
          <Btn kind="primary"   size="md" icon={<I.Plus size={13}/>}>Nova medida</Btn>
        </>}
      />

      <div className="px-8 py-5 grid grid-cols-[1fr_320px] gap-5 h-[calc(100%-100px)] overflow-auto">
        <div className="space-y-4 min-w-0">
          <Card padded={false}>
            <div className="px-5 py-3.5 flex items-center" style={{ borderBottom:'1px solid var(--border-hairline)' }}>
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase" style={{color:'var(--text-faint)'}}>Levey-Jennings · Nível 1</div>
                <div className="mt-1 flex items-center gap-3 font-mono text-[12px]">
                  <span style={{color:'var(--text-body)'}}>Média <strong style={{color:'var(--text-strong)'}}>13.62</strong> g/dL</span>
                  <span style={{color:'var(--text-faint)'}}>SD 0.28</span>
                  <span style={{color:'var(--text-faint)'}}>CV 2.05%</span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Seg options={[{value:'n1',label:'Nv 1'},{value:'n2',label:'Nv 2'}]} active="n1" />
                <Seg options={[{value:'14d',label:'14d'},{value:'28d',label:'28d'},{value:'90d',label:'90d'}]} active="28d" />
              </div>
            </div>
            <LJChart />
          </Card>

          <Card title="Histórico · 28 dias" padded={false}
                actions={<button className="text-[11px] font-medium" style={{color:'var(--accent-600)'}}>Ver todos →</button>}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color:'var(--text-faint)' }}>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-2.5 pl-5">Data</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-2.5">Operador</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-semibold py-2.5">Valor</th>
                  <th className="text-right text-[10px] uppercase tracking-wider font-semibold py-2.5">z-score</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-2.5 pl-3">Regras</th>
                  <th className="text-left text-[10px] uppercase tracking-wider font-semibold py-2.5 pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {HX.map((r,i)=>(
                  <tr key={i} style={{ borderTop:'1px solid var(--border-hairline)'}}>
                    <td className="py-2.5 pl-5 font-mono text-[11.5px]" style={{color:'var(--text-body)'}}>{r.dt}</td>
                    <td className="py-2.5" style={{color:'var(--text-body)'}}>{r.op}</td>
                    <td className="py-2.5 font-mono tabular-nums text-right" style={{color:'var(--text-strong)'}}>{r.val}</td>
                    <td className="py-2.5 font-mono tabular-nums text-right" style={{color: Math.abs(r.z)>2?'var(--danger-500)':Math.abs(r.z)>1?'var(--warning-500)':'var(--text-muted)'}}>{r.z>0?'+':''}{r.z.toFixed(2)}</td>
                    <td className="py-2.5 pl-3"><div className="flex gap-1">{r.rules.map(rr=><WgChip key={rr} rule={rr} active={r.rejected || rr==='1-2s'}/>)}</div></td>
                    <td className="py-2.5 pr-5"><Badge tone={r.rejected?'danger':r.rules.length?'warning':'success'}>{r.rejected?'Rejeitada':r.rules.length?'Aviso':'Aprovada'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Side panel */}
        <aside className="space-y-4">
          <Card title="Estado do lote">
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Fabricante</dt><dd style={{color:'var(--text-strong)'}}>Sysmex e-Check</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Validade</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>15 jun 2026</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Aberto em</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>02 abr 2026</dd></div>
              <div className="flex justify-between"><dt style={{color:'var(--text-muted)'}}>Estabilidade</dt><dd className="font-mono" style={{color:'var(--text-strong)'}}>34 d restantes</dd></div>
            </dl>
            <div className="mt-3.5 pt-3" style={{borderTop:'1px solid var(--border-hairline)'}}>
              <div className="flex items-center justify-between text-[11px]">
                <span style={{color:'var(--text-muted)'}}>Consumo</span><span className="font-mono" style={{color:'var(--text-strong)'}}>68 de 240</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{background:'var(--surface-muted)'}}>
                <div className="h-full rounded-full" style={{width:'28%', background:'var(--accent-600)'}}/>
              </div>
            </div>
          </Card>

          <Card title="Regras Westgard ativas" padded={false}>
            <ul>
              {WG_RULES.map((r,i)=>(
                <li key={r.id} className="px-4 py-2.5 flex items-center" style={{borderTop:i===0?'none':'1px solid var(--border-hairline)'}}>
                  <WgChip rule={r.id} active />
                  <div className="ml-3 min-w-0 flex-1">
                    <div className="text-[12px]" style={{color:'var(--text-body)'}}>{r.desc}</div>
                  </div>
                  <span className="text-[10px] font-mono" style={{color: r.type==='rj'?'var(--danger-500)':'var(--warning-500)'}}>{r.type==='rj'?'reject':'warn'}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Vínculos">
            <ul className="space-y-2.5 text-[12px]">
              <li className="flex items-center gap-2"><I.File size={13}/><a style={{color:'var(--accent-600)'}}>NC-2026-038 · Aviso recorrente</a></li>
              <li className="flex items-center gap-2"><I.Camera size={13}/><a style={{color:'var(--accent-600)'}}>Evidência fotográfica (2)</a></li>
              <li className="flex items-center gap-2"><I.Books size={13}/><a style={{color:'var(--accent-600)'}}>Procedimento POP-CQI-014</a></li>
            </ul>
          </Card>
        </aside>
      </div>
    </Shell>
  );
}

function WgChip({ rule, active = false }) {
  const tone = active ? (rule === '1-2s' ? 'warning' : 'danger') : 'neutral';
  const tones = {
    danger:  { bg:'var(--danger-50)',  fg:'var(--danger-500)', bd:'var(--danger-500)' },
    warning: { bg:'var(--warning-50)', fg:'var(--warning-500)', bd:'var(--warning-500)' },
    neutral: { bg:'transparent', fg:'var(--text-faint)', bd:'var(--border-soft)' },
  }[tone];
  return <span className="wg" style={{ background: tones.bg, color: tones.fg, borderColor: tones.bd, opacity: tone==='neutral'?0.6:1 }}>{rule}</span>;
}

const WG_RULES = [
  { id:'1-2s', desc:'1 valor além de ±2 SD',                       type:'warn' },
  { id:'1-3s', desc:'1 valor além de ±3 SD',                       type:'rj' },
  { id:'2-2s', desc:'2 consecutivos além de ±2 SD mesmo lado',     type:'rj' },
  { id:'R-4s', desc:'2 consecutivos com amplitude > 4 SD',         type:'rj' },
  { id:'4-1s', desc:'4 consecutivos além de ±1 SD mesmo lado',     type:'rj' },
  { id:'10x',  desc:'10 consecutivos mesmo lado da média',         type:'rj' },
];

const HX = [
  { dt:'13 mai 06:48', op:'R. Coutinho', val:'13.84', z:  0.79, rules:[],       rejected:false },
  { dt:'12 mai 06:51', op:'A. Pereira',  val:'13.41', z: -0.75, rules:[],       rejected:false },
  { dt:'11 mai 07:02', op:'A. Pereira',  val:'14.21', z:  2.11, rules:['1-2s'], rejected:false },
  { dt:'10 mai 06:55', op:'R. Coutinho', val:'13.55', z: -0.25, rules:[],       rejected:false },
  { dt:'09 mai 06:50', op:'C. Marques',  val:'13.18', z: -1.57, rules:[],       rejected:false },
  { dt:'08 mai 06:49', op:'C. Marques',  val:'14.50', z:  3.14, rules:['1-3s'], rejected:true },
  { dt:'07 mai 06:47', op:'R. Coutinho', val:'13.62', z:  0.00, rules:[],       rejected:false },
  { dt:'06 mai 06:51', op:'A. Pereira',  val:'13.59', z: -0.11, rules:[],       rejected:false },
];

function LJChart() {
  // Levey-Jennings: x = days, y = value. Mean 13.62, SD 0.28
  const pts = HX.slice().reverse().concat([{val:'13.84',z:0.79}]).slice(0,14).map((p,i)=>({x:i+1,z:Number(p.z||(Math.random()*2-1).toFixed(2))}));
  // Build extra synthetic pts
  while (pts.length < 28) pts.push({ x: pts.length+1, z: (Math.random()*3 - 1.5) * (Math.random()>0.85?2.2:1) });

  const W = 800, H = 280, padL = 56, padR = 16, padT = 16, padB = 28;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const yMin = -3.5, yMax = 3.5;
  const yToPx = (z) => padT + (1 - (z - yMin)/(yMax-yMin)) * innerH;
  const xToPx = (i) => padL + (i / 27) * innerW;

  const bands = [
    { y0: -1, y1: 1, fill: 'var(--success-50)' },
    { y0:  1, y1: 2, fill: 'transparent' },
    { y0: -2, y1:-1, fill: 'transparent' },
    { y0:  2, y1: 3, fill: 'var(--warning-50)' },
    { y0: -3, y1:-2, fill: 'var(--warning-50)' },
    { y0:  3, y1: yMax, fill: 'var(--danger-50)' },
    { y0: yMin, y1:-3, fill: 'var(--danger-50)' },
  ];

  return (
    <div className="px-2 pt-2 pb-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[300px]">
        {/* bands */}
        {bands.map((b,i)=>(
          <rect key={i} x={padL} y={yToPx(b.y1)} width={innerW} height={yToPx(b.y0)-yToPx(b.y1)} fill={b.fill}/>
        ))}
        {/* sd gridlines */}
        {[-3,-2,-1,0,1,2,3].map(z => (
          <g key={z}>
            <line x1={padL} y1={yToPx(z)} x2={W-padR} y2={yToPx(z)}
                  stroke={z===0?'var(--text-faint)':'var(--border-soft)'} strokeDasharray={z===0?'':'2 4'} />
            <text x={padL-8} y={yToPx(z)+3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-faint)">
              {z===0?'X̄':`${z>0?'+':''}${z}s`}
            </text>
          </g>
        ))}
        {/* x ticks */}
        {[1,7,14,21,28].map(d => (
          <text key={d} x={xToPx(d-1)} y={H-8} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-faint)">{d}d</text>
        ))}
        {/* polyline */}
        <polyline fill="none" stroke="var(--accent-600)" strokeWidth="1.6"
                  points={pts.map((p,i)=>`${xToPx(i)},${yToPx(p.z)}`).join(' ')} />
        {/* points */}
        {pts.map((p,i)=>{
          const fill = Math.abs(p.z) > 3 ? 'var(--danger-500)' : Math.abs(p.z) > 2 ? 'var(--warning-500)' : 'var(--accent-600)';
          return <circle key={i} cx={xToPx(i)} cy={yToPx(p.z)} r={Math.abs(p.z)>2?3.4:2.6} fill={fill} stroke="var(--surface-card)" strokeWidth="1.2"/>;
        })}
      </svg>
    </div>
  );
}

// ─── NOVA CORRIDA (workflow) ──────────────────────────────────────────────────

function NovaCorridaScreen() {
  return (
    <Shell page="corrida">
      <PageHeader title="Nova corrida"
        subtitle="Hematologia · Sysmex XN-1000 · 3 passos"
        actions={<><Btn kind="ghost" size="md">Cancelar</Btn><Btn kind="secondary" size="md">Salvar rascunho</Btn></>} />

      <div className="px-8 py-6 max-w-[1100px] mx-auto space-y-6 overflow-auto h-[calc(100%-100px)]">
        <Stepper steps={[
          { label:'Selecionar lote', done:true },
          { label:'Inserir valores', active:true },
          { label:'Revisar & aprovar' },
        ]} />

        <Card title="2 · Inserir valores · HC-2904">
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr style={{ color:'var(--text-faint)' }}>
                    <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2">Analito</th>
                    <th className="text-left text-[10px] uppercase tracking-wider font-semibold pb-2">Unidade</th>
                    <th className="text-right text-[10px] uppercase tracking-wider font-semibold pb-2">Alvo</th>
                    <th className="text-right text-[10px] uppercase tracking-wider font-semibold pb-2">Nv 1</th>
                    <th className="text-right text-[10px] uppercase tracking-wider font-semibold pb-2">Nv 2</th>
                    <th className="text-right text-[10px] uppercase tracking-wider font-semibold pb-2">Westgard</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {an:'HGB', un:'g/dL', t:'13.62', n1:'13.84', n2:'14.21', wg:['1-2s'], reject:false},
                    {an:'HCT', un:'%',    t:'40.1',  n1:'40.4',  n2:'41.1',  wg:[],       reject:false},
                    {an:'WBC', un:'×10⁹/L', t:'7.50',  n1:'7.62',  n2:'14.5', wg:['1-3s'], reject:true},
                    {an:'PLT', un:'×10⁹/L', t:'250',   n1:'247',  n2:'264',  wg:[],       reject:false},
                    {an:'RBC', un:'×10¹²/L', t:'4.85', n1:'4.88',  n2:'4.92', wg:[],       reject:false},
                  ].map((r,i)=>(
                    <tr key={i} style={{borderTop:'1px solid var(--border-hairline)'}}>
                      <td className="py-2.5 font-medium" style={{color:'var(--text-strong)'}}>{r.an}</td>
                      <td className="py-2.5 font-mono text-[11px]" style={{color:'var(--text-muted)'}}>{r.un}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums" style={{color:'var(--text-muted)'}}>{r.t}</td>
                      <td className="py-2.5 text-right">
                        <input defaultValue={r.n1} className="w-20 px-2 h-7 rounded font-mono text-[12px] tabular-nums text-right"
                               style={{background:'var(--surface-muted)', color:'var(--text-strong)'}}/>
                      </td>
                      <td className="py-2.5 text-right">
                        <input defaultValue={r.n2} className="w-20 px-2 h-7 rounded font-mono text-[12px] tabular-nums text-right"
                               style={{background: r.reject?'var(--danger-50)':'var(--surface-muted)',
                                        color: r.reject?'var(--danger-500)':'var(--text-strong)',
                                        outline: r.reject?'1px solid var(--danger-500)':'none' }}/>
                      </td>
                      <td className="py-2.5 text-right"><div className="flex justify-end gap-1">{r.wg.length?r.wg.map(g=><WgChip key={g} rule={g} active/>):<span style={{color:'var(--text-faint)'}}>—</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="space-y-3">
              <div className="rounded-lg p-3" style={{background:'var(--danger-50)', border:'1px solid var(--danger-500)'}}>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{color:'var(--danger-500)'}}>
                  <I.Triangle size={14}/> 1 rejeição · WBC nível 2
                </div>
                <p className="text-[11.5px] mt-1.5 leading-snug" style={{color:'var(--text-body)'}}>
                  Westgard 1-3s. Bloqueio automático na liberação. Documente causa antes de salvar.
                </p>
              </div>
              <textarea placeholder="Causa raiz (obrigatório se rejeitada)" rows={4}
                        className="w-full p-2.5 rounded-md text-[12px]"
                        style={{background:'var(--surface-muted)', color:'var(--text-body)', border:'1px solid var(--border-soft)'}}/>
              <Btn kind="secondary" size="md" icon={<I.Camera size={13}/>} className="w-full justify-center">Anexar evidência</Btn>
            </aside>
          </div>
          <div className="mt-5 pt-4 flex items-center" style={{borderTop:'1px solid var(--border-hairline)'}}>
            <Btn kind="ghost" size="md" icon={<I.ChevL size={13}/>}>Voltar</Btn>
            <Btn kind="primary" size="md" className="ml-auto" icon={<I.ChevR size={13}/>}>Revisar & aprovar</Btn>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function Stepper({ steps }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((s,i)=>(
        <React.Fragment key={i}>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold font-mono"
                 style={{
                   background: s.done ? 'var(--success-500)' : s.active ? 'var(--accent-600)' : 'var(--surface-card)',
                   color: s.done || s.active ? '#fff' : 'var(--text-faint)',
                   border: s.done||s.active ? 'none' : '1px solid var(--border-soft)',
                 }}>
              {s.done ? <I.Check size={12} strokeWidth={3}/> : i+1}
            </div>
            <span className="text-[12.5px]" style={{ color: s.active||s.done?'var(--text-strong)':'var(--text-faint)', fontWeight: s.active?600:400 }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-px mx-3" style={{ background: s.done?'var(--success-500)':'var(--border-soft)' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

Object.assign(window, { HubScreen, AnalyzerScreen, NovaCorridaScreen, LJChart, WgChip });
