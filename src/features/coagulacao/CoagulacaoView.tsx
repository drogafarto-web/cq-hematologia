import React, { useMemo, useState } from 'react';
import { useActiveLab, useIsSuperAdmin, useUser, useUserRole } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { ThemeToggle } from '../../shared/components/ui/ThemeToggle';
import { useCoagLots } from './hooks/useCoagLots';
import { CoagulacaoContent } from './components/CoagulacaoContent';
import { CoagLotSwitcher } from './components/CoagLotSwitcher';
import { EquipmentSetupBar } from '../insumos/components/EquipmentSetupBar';
import type { CoagulacaoLot } from './types/Coagulacao';
import type { CoagNivel } from './types/_shared_refs';
import { findCurrentLotByNivel, selectCurrentCompetenceLots } from './utils/currentCompetence';
import type { View } from '../../types';

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
    <path
      d="M8 2L3 6.5 8 11"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const CoagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path
      d="M2.5 10C4 7 6 13 8 10C10 7 12 13 14 10C15.5 7.5 17 10 17.5 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);
const DotsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
);
const SmallPlusIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ReportIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path
      d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeLab: { name: string } | null;
  userName: string;
  userRole: string;
  signOut: () => void;
  onNewRun: () => void;
  setCurrentView: (v: View) => void;
}

function Sidebar({
  activeLab,
  userName,
  userRole,
  signOut,
  onNewRun,
  setCurrentView,
}: SidebarProps) {
  const initials =
    userName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <aside className="w-[232px] shrink-0 bg-white dark:bg-[#0F1318] border-r border-slate-200 dark:border-white/[0.06] flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="w-[26px] h-[26px] rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0">
          <span className="font-mono text-[12px] font-semibold text-white dark:text-slate-900 leading-none tracking-tighter">
            hc
          </span>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-slate-800 dark:text-white/90 tracking-tight leading-none truncate">
            hc-quality<span className="text-slate-400 dark:text-slate-500">/cqi</span>
          </div>
          {activeLab && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[140px]">
              {activeLab.name}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {/* Back to hub */}
        <button
          type="button"
          onClick={() => setCurrentView('hub')}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all mb-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-700 dark:hover:text-slate-300"
        >
          <BackIcon /> Todos os módulos
        </button>

        {/* Module identity */}
        <div className="flex items-center gap-2 px-2.5 py-2 mb-1">
          <span className="text-rose-500 dark:text-rose-400">
            <CoagIcon />
          </span>
          <span className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
            Coagulação
          </span>
          <span className="ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            CLSI H21
          </span>
        </div>

        <div className="h-px bg-slate-100 dark:bg-white/[0.05] mx-2 my-2" />

        <p className="px-2.5 text-[11px] text-slate-400 dark:text-white/35 leading-snug mb-3">
          Troque o lote em uso na barra superior (Nível I / II), como na hematologia.
        </p>

        {/* Nova corrida */}
        <button
          type="button"
          onClick={onNewRun}
          className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-500/15"
        >
          <SmallPlusIcon /> Nova corrida
        </button>
      </div>

      {/* User chip */}
      <div className="border-t border-slate-100 dark:border-white/[0.05] p-3">
        <div className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-default">
          <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-700 dark:text-white/80 truncate leading-tight">
              {userName || 'Operador'}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight capitalize">
              {userRole ?? 'membro'}
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="ml-auto p-1 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
            title="Sair"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ──────────────────────────────────────────────────────────────────

interface TopbarProps {
  activeLab: { name: string } | null;
  userEmail: string;
  lots: CoagulacaoLot[];
  activeLot: CoagulacaoLot | null;
  setActiveLotId: (id: string) => void;
  setCurrentView: (v: View) => void;
  isSuperAdmin: boolean;
}

function Topbar({
  activeLab,
  userEmail,
  lots,
  activeLot,
  setActiveLotId,
  setCurrentView,
  isSuperAdmin,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px] text-slate-400 dark:text-slate-500">
        <span>{activeLab?.name ?? 'Lab'}</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="text-slate-700 dark:text-white/70 font-medium">Coagulação</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <CoagLotSwitcher
          lots={lots}
          activeLot={activeLot}
          onSelect={(id) => setActiveLotId(id)}
        />
        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hidden sm:inline-flex">
          RDC 302/2005
        </span>

        <ThemeToggle size="sm" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-52 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.10] shadow-2xl overflow-hidden py-1">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.07] mb-1">
                  <p className="text-xs text-slate-400 dark:text-white/40 truncate">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('hub');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 h-10 text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all flex items-center gap-2"
                >
                  <BackIcon /> Todos os módulos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('reports');
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 h-10 text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all flex items-center gap-2"
                >
                  <ReportIcon /> Gerar relatório
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('superadmin');
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 h-10 text-left text-sm text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white/85 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all"
                  >
                    Super Admin
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── CoagulacaoView ──────────────────────────────────────────────────────────

export function CoagulacaoView() {
  const { signOut } = useAuthFlow();
  const activeLab = useActiveLab();
  const isSuperAdmin = useIsSuperAdmin();
  const user = useUser();
  const userRole = useUserRole();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const { lots } = useCoagLots();
  const [userSelectedLotId, setActiveLotId] = useState<string | null>(null);
  const [newRunTrigger, setNewRunTrigger] = useState(0);
  const [newRunNivel, setNewRunNivel] = useState<CoagNivel | undefined>(undefined);

  const currentLots = useMemo(() => selectCurrentCompetenceLots(lots), [lots]);

  const activeLot = useMemo(() => {
    if (userSelectedLotId) {
      const selected = lots.find((l) => l.id === userSelectedLotId);
      if (selected) return selected;
    }
    return (
      findCurrentLotByNivel(lots, 'I') ??
      currentLots[0] ??
      lots[0] ??
      null
    );
  }, [lots, userSelectedLotId, currentLots]);

  const activeLotId = activeLot?.id ?? null;

  const handleNewRun = (nivel?: CoagNivel) => {
    setNewRunNivel(nivel);
    setNewRunTrigger((t) => t + 1);
  };

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Operador';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white overflow-hidden">
      <Sidebar
        activeLab={activeLab}
        userName={userName}
        userRole={userRole ?? 'membro'}
        signOut={signOut}
        onNewRun={() => handleNewRun()}
        setCurrentView={setCurrentView}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          activeLab={activeLab}
          userEmail={user?.email ?? ''}
          lots={lots}
          activeLot={activeLot}
          setActiveLotId={setActiveLotId}
          setCurrentView={setCurrentView}
          isSuperAdmin={isSuperAdmin}
        />

        <EquipmentSetupBar
          module="coagulacao"
          onEditSetup={() => setCurrentView('insumos')}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] w-full mx-auto px-8 py-6 pb-10">
            <CoagulacaoContent
              lots={lots}
              activeLotId={activeLotId}
              setActiveLotId={setActiveLotId}
              newRunTrigger={newRunTrigger}
              newRunNivel={newRunNivel}
              onNewRunForNivel={(nivel) => handleNewRun(nivel)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
