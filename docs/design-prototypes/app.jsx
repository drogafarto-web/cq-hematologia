/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle, TweakColor,
   FoundationCard, HubScreen, AnalyzerScreen, NovaCorridaScreen,
   NCScreen, AuditoriaScreen, NotivisaScreen,
   EquipamentosScreen, TemperaturaScreen, TreinamentosScreen, RiscosScreen, LiberacaoScreen,
   MobileHubScreen, MobileNCDetailScreen, TabletAnalyzerScreen */
const { useEffect } = React;

// ─── Tweak defaults (persisted on disk via Tweaks Panel host protocol) ────────
const TWEAKS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "cozy",
  "accent": "#2563eb",
  "font": "inter"
}/*EDITMODE-END*/;

const ACCENTS = {
  '#2563eb': { c50:'#EFF4FF', c500:'#3B82F6', c600:'#2563EB', c700:'#1D4ED8', tint:'rgba(37,99,235,0.10)' },
  '#0891b2': { c50:'#ECFEFF', c500:'#06B6D4', c600:'#0891B2', c700:'#0E7490', tint:'rgba(8,145,178,0.10)'  },
  '#4f46e5': { c50:'#EEF2FF', c500:'#6366F1', c600:'#4F46E5', c700:'#4338CA', tint:'rgba(79,70,229,0.10)'  },
  '#059669': { c50:'#ECFDF5', c500:'#10B981', c600:'#059669', c700:'#047857', tint:'rgba(5,150,105,0.10)'  },
  '#d97706': { c50:'#FFFBEB', c500:'#F59E0B', c600:'#D97706', c700:'#B45309', tint:'rgba(217,119,6,0.10)'  },
  '#e11d48': { c50:'#FFF1F2', c500:'#F43F5E', c600:'#E11D48', c700:'#BE123C', tint:'rgba(225,29,72,0.10)'  },
};

const FONTS = {
  inter:    { sans:"'Inter'",          mono:"'JetBrains Mono'" },
  ibm:      { sans:"'IBM Plex Sans'",  mono:"'IBM Plex Mono'"  },
  geist:    { sans:"'Geist'",          mono:"'Geist Mono'"     },
  sourceSans:{ sans:"'Source Sans 3'", mono:"'Source Code Pro'" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAKS);
  const accent = ACCENTS[String(t.accent).toLowerCase()] || ACCENTS['#2563eb'];
  const dark = t.theme === 'dark';

  useEffect(() => {
    const f = FONTS[t.font] || FONTS.inter;
    document.documentElement.style.setProperty('--font-sans', `${f.sans}, system-ui, -apple-system, sans-serif`);
    document.documentElement.style.setProperty('--font-mono', `${f.mono}, ui-monospace, Menlo, monospace`);
  }, [t.font]);

  // For each screen artboard, pass dark + accent + density via wrappers
  const wrap = (Component, props = {}) => (
    <div data-density={t.density}><Component dark={dark} accent={accent} density={t.density} {...props}/></div>
  );

  // Force-themed wrapper: ignores global toggle (used in the "Light vs Dark" showcase)
  const wrapForce = (Component, forceDark, props = {}) => (
    <div data-density={t.density}><Component dark={forceDark} accent={accent} density={t.density} {...props}/></div>
  );

  // Patch Shell to receive dark/accent/density props. The Shell component already
  // accepts them and applies classes. But our existing screen components hard-code
  // <Shell page="..."> without those props. We override Shell here by mutating
  // its render context via a global. Simpler: re-export themed shells. Since
  // each screen already uses `Shell` we'll monkey-patch via window proxy
  // approach is not clean. Instead, let's just wrap each artboard in a themed
  // root div with `.dark` and density data attr, and pass accent via CSS vars.

  const artboardStyle = {
    '--accent-50':  accent.c50,
    '--accent-500': accent.c500,
    '--accent-600': accent.c600,
    '--accent-700': accent.c700,
    '--accent-tint': accent.tint,
  };

  const Themed = ({ children, force }) => (
    <div className={(force ?? dark) ? 'dark' : ''} data-density={t.density} style={{...artboardStyle, width:'100%', height:'100%'}}>
      {children}
    </div>
  );

  return (
    <>
      <DesignCanvas title="hc-quality · Telas unificadas"
                    subtitle="Light & dark · uniformidade dos módulos · accent · densidade configuráveis">

        {/* 0 — Foundation */}
        <DCSection id="fnd" title="Foundation" subtitle="Tokens, tipografia, componentes-chave do design system">
          <DCArtboard id="fnd-1" label="Foundation · light / dark sync" width={1440} height={900}>
            <Themed><FoundationCard dark={dark} accent={accent}/></Themed>
          </DCArtboard>
        </DCSection>

        {/* 1 — Comparação claro/escuro (estático) */}
        <DCSection id="cmp" title="Claro × Escuro" subtitle="A mesma tela em ambos os modos. Toggle global do Tweaks afeta as outras seções.">
          <DCArtboard id="cmp-light" label="Hub · light" width={1440} height={900}>
            <Themed force={false}><HubScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="cmp-dark" label="Hub · dark" width={1440} height={900}>
            <Themed force={true}><HubScreen/></Themed>
          </DCArtboard>
        </DCSection>

        {/* 2 — Operação diária */}
        <DCSection id="op" title="Operação CQI" subtitle="Hub, Analyzer, Nova corrida — fluxos do dia a dia do biomédico">
          <DCArtboard id="op-hub" label="Hub" width={1440} height={900}>
            <Themed><HubScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="op-an" label="Analyzer · Westgard" width={1440} height={900}>
            <Themed><AnalyzerScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="op-novo" label="Nova corrida · workflow" width={1440} height={900}>
            <Themed><NovaCorridaScreen/></Themed>
          </DCArtboard>
        </DCSection>

        {/* 3 — Qualidade & conformidade */}
        <DCSection id="ql" title="Qualidade & conformidade" subtitle="NC, CAPA, auditoria trail, NOTIVISA">
          <DCArtboard id="ql-nc" label="Não conformidades · lista + detalhe" width={1440} height={900}>
            <Themed><NCScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ql-aud" label="Audit trail · cadeia HMAC" width={1440} height={900}>
            <Themed><AuditoriaScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ql-nv" label="NOTIVISA portal" width={1440} height={900}>
            <Themed><NotivisaScreen/></Themed>
          </DCArtboard>
        </DCSection>

        {/* 4 — Operacional */}
        <DCSection id="ops" title="Operacional" subtitle="Equipamentos, temperatura, treinamentos, riscos, liberação">
          <DCArtboard id="ops-eq" label="Equipamentos & calibração" width={1440} height={900}>
            <Themed><EquipamentosScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ops-tp" label="Temperatura · realtime" width={1440} height={900}>
            <Themed><TemperaturaScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ops-tr" label="Educação continuada" width={1440} height={900}>
            <Themed><TreinamentosScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ops-rk" label="Gestão de riscos · matriz 5×5" width={1440} height={900}>
            <Themed><RiscosScreen/></Themed>
          </DCArtboard>
          <DCArtboard id="ops-lib" label="Liberação · pré/pós-analítico" width={1440} height={900}>
            <Themed><LiberacaoScreen/></Themed>
          </DCArtboard>
        </DCSection>

        {/* 5 — Tablet */}
        <DCSection id="tab" title="Tablet 1024" subtitle="Sidebar colapsada — adaptação para uso à bancada">
          <DCArtboard id="tab-an" label="Analyzer · tablet · light" width={1100} height={840}>
            <TabletAnalyzerScreen dark={false} accent={accent}/>
          </DCArtboard>
          <DCArtboard id="tab-an-dk" label="Analyzer · tablet · dark" width={1100} height={840}>
            <TabletAnalyzerScreen dark={true} accent={accent}/>
          </DCArtboard>
        </DCSection>

        {/* 6 — Mobile */}
        <DCSection id="mob" title="Mobile 390" subtitle="App mobile (RN) — Hub e detalhe de NC. Frame ilustra a chrome do dispositivo.">
          <DCArtboard id="mob-hub" label="Hub · light" width={460} height={890}>
            <MobileHubScreen dark={false} accent={accent}/>
          </DCArtboard>
          <DCArtboard id="mob-hub-dk" label="Hub · dark" width={460} height={890}>
            <MobileHubScreen dark={true} accent={accent}/>
          </DCArtboard>
          <DCArtboard id="mob-nc" label="NC detalhe" width={460} height={890}>
            <MobileNCDetailScreen dark={dark} accent={accent}/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks · sistema unificado">
        <TweakSection label="Tema & densidade"/>
        <TweakRadio label="Tema" value={t.theme} onChange={v=>setTweak('theme',v)}
          options={[{value:'light',label:'Claro'},{value:'dark',label:'Escuro'}]}/>
        <TweakRadio label="Densidade" value={t.density} onChange={v=>setTweak('density',v)}
          options={[{value:'compact',label:'Compacta'},{value:'cozy',label:'Padrão'},{value:'comfortable',label:'Confortável'}]}/>

        <TweakSection label="Cor de destaque"/>
        <TweakColor label="Accent" value={t.accent} onChange={v=>setTweak('accent',v)}
          options={['#2563eb','#0891b2','#4f46e5','#059669','#d97706','#e11d48']}/>

        <TweakSection label="Tipografia"/>
        <TweakSelect label="Família" value={t.font} onChange={v=>setTweak('font',v)}
          options={[
            { value:'inter',      label:'Inter + JetBrains Mono (padrão)' },
            { value:'ibm',        label:'IBM Plex Sans + Plex Mono' },
            { value:'geist',      label:'Geist + Geist Mono' },
            { value:'sourceSans', label:'Source Sans 3 + Source Code Pro' },
          ]}/>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
