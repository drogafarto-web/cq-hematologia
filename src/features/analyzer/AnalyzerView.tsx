import React, { useState, useEffect, useCallback } from 'react';
import { useLots } from '../lots/hooks/useLots';
import { useRuns } from '../runs/hooks/useRuns';
import { useChartData } from '../chart/hooks/useChartData';
import { useStatsByMode } from '../chart/hooks/useStatsByMode';
import { useCIQLots } from '../ciq-imuno/hooks/useCIQLots';
import { LotManager } from '../lots/LotManager';
import { ReviewRunModal } from '../runs/ReviewRunModal';
import { DashboardScreen } from './screens/DashboardScreen';
import { NovaCorridaScreen } from './screens/NovaCorridaScreen';
import { AnaliseScreen } from './screens/AnaliseScreen';
import { HistoricoScreen } from './screens/HistoricoScreen';
import { CIQImunoContent } from '../ciq-imuno/components/CIQImunoContent';
import { useActiveLab, useIsSuperAdmin, useUser, useUserRole } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { ThemeToggle } from '../../shared/components/ui/ThemeToggle';
import { ANALYTE_MAP } from '../../constants';
import { LotSwitcher } from './components/LotSwitcher';
import type { ControlLot, SyncStatus, View } from '../../types';
import type { CIQImunoLot } from '../ciq-imuno/types/CIQImuno';
import type { CIQLotStatus } from '../ciq-imuno/types/_shared_refs';

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'nova' | 'analise' | 'historico' | 'lotes';
type Module = 'analyzer' | 'ciq-imuno';

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 103-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}
function FlaskIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2h6M10 2v6L4 19a2 2 0 001.7 3h12.6A2 2 0 0020 19L14 8V2M7 13h10" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06.06A1.65 1.65 0 005.05 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M8 2L3 6.5 8 11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ReportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ImunoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2v3M10 15v3M2 10h3M15 10h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
function SmallPlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ─── Sync dot ─────────────────────────────────────────────────────────────────

const SYNC_CFG: Record<SyncStatus, { dot: string; label: string; pulse?: boolean }> = {
  saved: { dot: 'bg-emerald-500', label: 'Salvo' },
  saving: { dot: 'bg-amber-400', label: 'Salvando', pulse: true },
  offline: { dot: 'bg-slate-400', label: 'Offline' },
  error: { dot: 'bg-red-500', label: 'Erro' },
};

function SyncDot({ status }: { status: SyncStatus }) {
  const c = SYNC_CFG[status];
  return (
    <div className="flex items-center gap-1.5 px-2">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">{c.label}</span>
    </div>
  );
}

// ─── Page titles ──────────────────────────────────────────────────────────────

const PAGE_META: Record<Page, { section: string; title: string }> = {
  dashboard: { section: 'Operação', title: 'Dashboard' },
  nova: { section: 'Operação', title: 'Nova corrida' },
  analise: { section: 'Operação', title: 'Análise' },
  historico: { section: 'Operação', title: 'Histórico' },
  lotes: { section: 'Configuração', title: 'Lotes' },
};

// ─── CIQ-Imuno lot status ─────────────────────────────────────────────────────

const CIQ_STATUS_DOT: Record<CIQLotStatus, string> = {
  sem_dados: 'bg-slate-400',
  valido: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  reprovado: 'bg-red-500',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  module: Module;
  page: Page;
  setPage: (p: Page) => void;
  activeLab: { name: string } | null;
  userName: string;
  userRole: string;
  setCurrentView: (v: View) => void;
  signOut: () => void;
  isSuperAdmin: boolean;
  // CIQ-Imuno
  ciqLots: CIQImunoLot[];
  ciqActiveLotId: string | null;
  setCiqActiveLotId: (id: string | null) => void;
  onCiqNewRun: () => void;
}

function Sidebar({
  module,
  page,
  setPage,
  activeLab,
  userName,
  userRole,
  setCurrentView,
  signOut,
  isSuperAdmin,
  ciqLots,
  ciqActiveLotId,
  setCiqActiveLotId,
  onCiqNewRun,
}: SidebarProps) {
  const initials =
    userName
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?';

  // ── Analyzer nav ────────────────────────────────────────────────────────────
  const navItems: { id: Page; label: string; icon: React.ReactNode; kbd: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <HomeIcon />, kbd: 'D' },
    { id: 'nova', label: 'Nova corrida', icon: <PlusIcon />, kbd: 'N' },
    { id: 'analise', label: 'Análise', icon: <ChartIcon />, kbd: 'A' },
    { id: 'historico', label: 'Histórico', icon: <HistoryIcon />, kbd: 'H' },
  ];

  return (
    <aside className="w-[232px] shrink-0 bg-white dark:bg-[#0F1318] border-r border-slate-200 dark:border-white/[0.06] flex flex-col h-screen sticky top-0 overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="w-[26px] h-[26px] rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0">
          <span className="font-mono text-[12px] font-semibold text-white dark:text-slate-900 leading-none tracking-tighter">
            hc
          </span>
        </div>
        <div>
          <div className="font-mono text-sm font-semibold text-slate-800 dark:text-white/90 tracking-tight leading-none">
            hc-quality<span className="text-slate-400 dark:text-slate-500">/cqi</span>
          </div>
          {activeLab && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[140px]">
              {activeLab.name}
            </div>
          )}
        </div>
      </div>

      {/* Nav content — switches by module */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {module === 'analyzer' && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-2">
              Operação
            </div>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-all mb-0.5 ${
                  page === item.id
                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-white/80'
                }`}
              >
                <span
                  className={`shrink-0 ${page === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
                >
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08]">
                  {item.kbd}
                </kbd>
              </button>
            ))}

            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-2 mt-3">
              Configuração
            </div>
            <button
              type="button"
              onClick={() => setPage('lotes')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-all mb-0.5 ${
                page === 'lotes'
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-white/80'
              }`}
            >
              <span
                className={`shrink-0 ${page === 'lotes' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <FlaskIcon />
              </span>
              <span className="flex-1 text-left">Lotes de controle</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('bulaparser')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-all mb-0.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-white/80"
            >
              <span className="shrink-0 text-slate-400 dark:text-slate-500">
                <SettingsIcon />
              </span>
              <span className="flex-1 text-left">Importar bula</span>
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCurrentView('superadmin')}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-all mb-0.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-white/80"
              >
                <span className="shrink-0 text-slate-400 dark:text-slate-500">
                  <SettingsIcon />
                </span>
                <span className="flex-1 text-left">Super Admin</span>
              </button>
            )}

            {/* Módulos section */}
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-2 mt-3">
              Módulos
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('ciq-imuno')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-all mb-0.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-white/80"
            >
              <span className="shrink-0 text-emerald-500 dark:text-emerald-400">
                <ImunoIcon />
              </span>
              <span className="flex-1 text-left">CIQ-Imuno</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                RDC
              </span>
            </button>
          </>
        )}

        {module === 'ciq-imuno' && (
          <>
            {/* Back to analyzer */}
            <button
              type="button"
              onClick={() => setCurrentView('analyzer')}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all mb-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-700 dark:hover:text-slate-300"
            >
              <BackIcon /> CQ Hematologia
            </button>

            {/* Module identity */}
            <div className="flex items-center gap-2 px-2.5 py-2 mb-1">
              <span className="text-emerald-500 dark:text-emerald-400">
                <ImunoIcon />
              </span>
              <span className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                CIQ-Imuno
              </span>
              <span className="ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                RDC 978
              </span>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/[0.05] mx-2 my-2" />

            {/* Lot list */}
            {ciqLots.length > 0 && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 py-2">
                  Lotes
                </div>
                <div className="space-y-1">
                  {ciqLots.map((lot) => {
                    const isActive = lot.id === (ciqActiveLotId ?? ciqLots[0]?.id);
                    return (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => setCiqActiveLotId(lot.id)}
                        className={`w-full text-left px-2.5 py-2.5 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-200 dark:hover:border-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[13px] font-medium truncate ${isActive ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-white/75'}`}
                          >
                            {lot.testType}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${CIQ_STATUS_DOT[lot.lotStatus]}`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 dark:text-white/30">
                          <span className="font-mono truncate">{lot.loteControle}</span>
                          <span>·</span>
                          <span>
                            {lot.runCount} run{lot.runCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="h-px bg-slate-100 dark:bg-white/[0.05] mx-2 my-3" />

            {/* Nova corrida */}
            <button
              type="button"
              onClick={onCiqNewRun}
              className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              <SmallPlusIcon /> Nova corrida
            </button>
          </>
        )}
      </div>

      {/* User chip */}
      <div className="border-t border-slate-100 dark:border-white/[0.05] p-3">
        <div className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-default">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[11px] font-semibold shrink-0">
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
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarProps {
  module: Module;
  page: Page;
  activeLab: { name: string } | null;
  activeLot: ControlLot | null;
  lots: ControlLot[];
  selectLot: (id: string) => Promise<void>;
  syncStatus: SyncStatus;
  setCurrentView: (v: View) => void;
  isSuperAdmin: boolean;
  userEmail: string;
}

function Topbar({
  module,
  page,
  activeLab,
  activeLot,
  lots,
  selectLot,
  syncStatus,
  setCurrentView,
  isSuperAdmin,
  userEmail,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const breadcrumbs =
    module === 'ciq-imuno'
      ? [activeLab?.name ?? 'Lab', 'CIQ-Imuno']
      : [
          activeLab?.name ?? 'Lab',
          PAGE_META[page].section,
          PAGE_META[page].title,
          ...(activeLot ? [activeLot.controlName || activeLot.lotNumber] : []),
        ];

  return (
    <header className="h-14 bg-white dark:bg-[#0F1318] border-b border-slate-200 dark:border-white/[0.06] flex items-center gap-4 px-6 sticky top-0 z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px] text-slate-400 dark:text-slate-500">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
            <span
              className={
                i === breadcrumbs.length - 1 ? 'text-slate-700 dark:text-white/70 font-medium' : ''
              }
            >
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Active lot chip — analyzer only */}
      {module === 'analyzer' && (
        <LotSwitcher lots={lots} activeLot={activeLot} selectLot={selectLot} />
      )}

      {/* Right */}
      <div className="ml-auto flex items-center gap-2">
        {module === 'analyzer' && (
          <>
            <div className="relative w-60">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Buscar corridas, analitos…"
                className="w-full h-8 pl-7 pr-3 text-xs bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:border-blue-400 dark:focus:border-blue-500/50 transition-all"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] px-1 py-0.5 rounded">
                ⌘K
              </span>
            </div>
            <SyncDot status={syncStatus} />
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Notificações"
            >
              <BellIcon />
            </button>
          </>
        )}

        {module === 'ciq-imuno' && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hidden sm:inline-flex">
            RDC 978/2025
          </span>
        )}

        <ThemeToggle size="sm" />

        {/* Overflow menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Menu"
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

// ─── AnalyzerView ─────────────────────────────────────────────────────────────

export function AnalyzerView() {
  const { signOut } = useAuthFlow();
  const activeLab = useActiveLab();
  const isSuperAdmin = useIsSuperAdmin();
  const user = useUser();
  const userRole = useUserRole();
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const module: Module = currentView === 'ciq-imuno' ? 'ciq-imuno' : 'analyzer';

  // ── Analyzer state ──────────────────────────────────────────────────────────
  const {
    lots,
    activeLot,
    activeLotId,
    selectedAnalyteId,
    syncStatus,
    addLot,
    deleteLot,
    selectLot,
    setSelectedAnalyte,
  } = useLots();
  const {
    pendingRun,
    isExtracting,
    isConfirming,
    error: runError,
    newRun,
    confirmRun,
    cancelRun,
  } = useRuns();

  const [showAddLot, setShowAddLot] = useState(false);

  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem('hcq_page') as Page | null;
    return saved && ['dashboard', 'nova', 'analise', 'historico', 'lotes'].includes(saved)
      ? saved
      : 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('hcq_page', page);
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (module !== 'analyzer') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Page> = { d: 'dashboard', n: 'nova', a: 'analise', h: 'historico' };
      const dest = map[e.key.toLowerCase()];
      if (dest) setPage(dest);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [module]);

  const validAnalyteId =
    activeLot && selectedAnalyteId && activeLot.requiredAnalytes.includes(selectedAnalyteId)
      ? selectedAnalyteId
      : null;
  const statsMode = useStatsByMode(activeLot ?? null, validAnalyteId);
  const chartData = useChartData(activeLot ?? null, validAnalyteId, statsMode.mode);
  const currentAnalyte = validAnalyteId ? ANALYTE_MAP[validAnalyteId] : null;
  const goTo = useCallback((p: string) => setPage(p as Page), []);

  // ── CIQ-Imuno state ─────────────────────────────────────────────────────────
  const { lots: ciqLots } = useCIQLots();
  const [userSelectedCiqLotId, setCiqActiveLotId] = useState<string | null>(null);
  const [ciqNewRunTrigger, setCiqNewRunTrigger] = useState(0);

  // Lote ativo derivado (escolha do usuário OU primeiro disponível).
  // Só "vira" real quando estamos no módulo ciq-imuno — outros módulos ignoram.
  const ciqActiveLotId =
    module === 'ciq-imuno' ? (userSelectedCiqLotId ?? ciqLots[0]?.id ?? null) : userSelectedCiqLotId;

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Operador';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        module={module}
        page={page}
        setPage={setPage}
        activeLab={activeLab}
        userName={userName}
        userRole={userRole ?? 'membro'}
        setCurrentView={setCurrentView}
        signOut={signOut}
        isSuperAdmin={isSuperAdmin}
        ciqLots={ciqLots}
        ciqActiveLotId={ciqActiveLotId}
        setCiqActiveLotId={setCiqActiveLotId}
        onCiqNewRun={() => setCiqNewRunTrigger((t) => t + 1)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          module={module}
          page={page}
          activeLab={activeLab}
          activeLot={activeLot ?? null}
          lots={lots}
          selectLot={selectLot}
          syncStatus={syncStatus}
          setCurrentView={setCurrentView}
          isSuperAdmin={isSuperAdmin}
          userEmail={user?.email ?? ''}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] w-full mx-auto px-8 py-6 pb-10">
            {/* ── Analyzer screens ─────────────────────────────────────────── */}
            {module === 'analyzer' && (
              <>
                {page === 'dashboard' && (
                  <DashboardScreen
                    lots={lots}
                    activeLot={activeLot ?? null}
                    goTo={goTo}
                    setCurrentView={setCurrentView}
                  />
                )}
                {page === 'nova' && (
                  <NovaCorridaScreen
                    lots={lots}
                    activeLot={activeLot ?? null}
                    selectLot={selectLot}
                    pendingRun={pendingRun}
                    newRun={newRun}
                    isExtracting={isExtracting}
                    error={runError}
                    goTo={goTo}
                  />
                )}
                {page === 'analise' && (
                  <AnaliseScreen
                    lots={lots}
                    activeLot={activeLot ?? null}
                    selectLot={selectLot}
                    validAnalyteId={validAnalyteId}
                    setSelectedAnalyte={setSelectedAnalyte}
                    statsMode={statsMode}
                    chartData={chartData}
                    currentAnalyte={currentAnalyte}
                    goTo={goTo}
                  />
                )}
                {page === 'historico' && <HistoricoScreen lots={lots} goTo={goTo} />}
                {page === 'lotes' && (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          Lotes de controle
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                          Gerencie os lotes de controle interno do laboratório
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddLot(true)}
                        className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-lg shadow-violet-500/20"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path
                            d="M7 2v10M2 7h10"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                        Novo lote
                      </button>
                    </div>
                    <div className="max-w-2xl">
                      <LotManager
                        lots={lots}
                        activeLotId={activeLotId ?? null}
                        showAdd={showAddLot}
                        onCloseAdd={() => setShowAddLot(false)}
                        onAdd={addLot}
                        onDelete={deleteLot}
                        onSelect={async (id) => {
                          await selectLot(id);
                          setPage('analise');
                        }}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── CIQ-Imuno content ────────────────────────────────────────── */}
            {module === 'ciq-imuno' && (
              <CIQImunoContent
                lots={ciqLots}
                activeLotId={ciqActiveLotId}
                setActiveLotId={setCiqActiveLotId}
                newRunTrigger={ciqNewRunTrigger}
              />
            )}
          </div>
        </main>
      </div>

      {/* Analyzer: review modal */}
      {module === 'analyzer' && pendingRun && activeLot && (
        <ReviewRunModal
          pendingRun={pendingRun}
          activeLot={activeLot}
          onConfirm={confirmRun}
          onCancel={cancelRun}
          isConfirming={isConfirming}
        />
      )}
    </div>
  );
}
