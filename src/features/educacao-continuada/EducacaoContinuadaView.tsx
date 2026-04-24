import { useState } from 'react';

import { useActiveLab, useUser } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

import { ECDashboard } from './components/ECDashboard';
import { AlertasTab } from './components/_tabs/AlertasTab';
import { ColaboradoresTab } from './components/_tabs/ColaboradoresTab';
import { ExecucoesTab } from './components/_tabs/ExecucoesTab';
import { IndicadoresTab } from './components/_tabs/IndicadoresTab';
import { MatrizTab } from './components/_tabs/MatrizTab';
import { useAlertasVencimento } from './hooks/useAlertasVencimento';

type TabId =
  | 'planejamento'
  | 'execucoes'
  | 'colaboradores'
  | 'matriz'
  | 'alertas'
  | 'indicadores';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: ReadonlyArray<TabDef> = [
  { id: 'planejamento', label: 'Planejamento', icon: <IconCalendar /> },
  { id: 'execucoes', label: 'Execuções', icon: <IconCheckSquare /> },
  { id: 'colaboradores', label: 'Colaboradores', icon: <IconUsers /> },
  { id: 'matriz', label: 'Matriz', icon: <IconGrid /> },
  { id: 'alertas', label: 'Alertas', icon: <IconBell /> },
  { id: 'indicadores', label: 'Indicadores', icon: <IconBarChart /> },
];

/**
 * Entry point do módulo Educação Continuada. Integra:
 *  - Planejamento (FR-027) via ECDashboard (Fase 2)
 *  - Execuções (FR-001) com ciclo completo (Fase 3)
 *  - Colaboradores + prontuários (Fase 1 + 4)
 *  - Alertas de vencimento (RN-05, Fase 5)
 *  - Indicadores consolidados + emissão de relatórios PDF (Fase 5)
 */
export function EducacaoContinuadaView() {
  const [tab, setTab] = useState<TabId>('planejamento');
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const activeLab = useActiveLab();
  const user = useUser();

  const { alertasIminentes, alertasVencidos } = useAlertasVencimento();
  const totalAlertasCriticos = alertasIminentes.length + alertasVencidos.length;

  // RN-08 (Fase 7): trigger server-side `ec_onColaboradorCreated` cria o
  // progresso automaticamente via Admin SDK (2026-04-24 cleanup). Observer
  // client-side (`useAutoStartTrilhasRN08`) removido para eliminar race window.

  const initial =
    (user?.displayName?.split(' ')[0]?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <style>{`
        @keyframes ecFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ec-fade-in { animation: ecFadeIn 240ms ease-out; }
      `}</style>

      {/* Topbar sticky — contexto do tenant sempre visível */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <IconArrowLeft />
              Hub
            </button>
            <div className="h-5 w-px bg-slate-800" aria-hidden />
            <h1 className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-base font-semibold text-transparent sm:text-lg">
              Educação Continuada
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm text-slate-300">{activeLab?.name ?? '—'}</p>
              {activeLab?.id && (
                <p className="text-[10px] text-slate-600">ID: {activeLab.id}</p>
              )}
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-medium text-slate-300"
              aria-label={user?.displayName ?? user?.email ?? 'Usuário'}
            >
              {initial}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <TabBar value={tab} onChange={setTab} alertCount={totalAlertasCriticos} />

        <div
          id="ec-tabpanel"
          role="tabpanel"
          key={tab}
          className="ec-fade-in mt-6 min-h-[60vh]"
        >
          {tab === 'planejamento' && <ECDashboard />}
          {tab === 'execucoes' && <ExecucoesTab />}
          {tab === 'colaboradores' && <ColaboradoresTab />}
          {tab === 'matriz' && <MatrizTab />}
          {tab === 'alertas' && <AlertasTab />}
          {tab === 'indicadores' && <IndicadoresTab />}
        </div>
      </main>
    </div>
  );
}

// ─── TabBar ──────────────────────────────────────────────────────────────────

interface TabBarProps {
  value: TabId;
  onChange: (id: TabId) => void;
  alertCount: number;
}

function TabBar({ value, onChange, alertCount }: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Seções do módulo Educação Continuada"
      className="flex items-center gap-1 overflow-x-auto border-b border-slate-800"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        const showBadge = t.id === 'alertas' && alertCount > 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            role="tab"
            aria-selected={active ? 'true' : 'false'}
            aria-controls="ec-tabpanel"
            className={`group relative flex shrink-0 items-center gap-2 rounded-t-md px-4 py-2.5 text-sm font-medium outline-none transition-colors ${
              active
                ? 'text-emerald-300'
                : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
            }`}
          >
            <span
              className={`transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}
              aria-hidden
            >
              {t.icon}
            </span>
            {t.label}
            {showBadge && (
              <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-red-500/40 bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-300">
                {alertCount}
              </span>
            )}
            {active && (
              <span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-500 shadow-[0_-2px_8px_rgba(16,185,129,0.5)]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Ícones SVG inline (zero-KB) ─────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M11 7H3M6 4L3 7l3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconCheckSquare() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="11.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11.5 9c1.8 0 3 1.3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5a4 4 0 0 0-4 4v2.5L2.5 11h11L12 8V5.5a4 4 0 0 0-4-4zM6.5 13.5a1.5 1.5 0 0 0 3 0"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="3.5" y="8" width="2" height="5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7" y="4" width="2" height="9" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.5" y="6" width="2" height="7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
